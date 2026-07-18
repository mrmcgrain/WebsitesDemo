#!/usr/bin/env python3
"""Local controller for the Google Places leads dashboard.

Run from this directory:

    python3 dashboard_server.py --host 0.0.0.0 --port 8140

The static GitHub Pages version is view-only. This local controller serves the
same files and adds API routes that can run Google Places searches, write a new
JSON export under ./output/, then refresh leads-data.json and leads-data.js.

Configuration lookup, first match wins:
  1. GOOGLE_PLACES_API_KEY / GOOGLE_MAPS_API_KEY / GOOGLE_API_KEY env var
  2. ./config.yaml with api_key: ... or google_places_api_key: ...
  3. ./dashboard-config.json with api_key / google_places_api_key

Keep real API keys out of git. Use config.yaml locally; commit only the example.
"""
from __future__ import annotations

import argparse
import copy
import csv
import html
import json
import os
import re
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
DATA_JSON = ROOT / "leads-data.json"
DATA_JS = ROOT / "leads-data.js"
OUTPUT_DIR = ROOT / "output"
STATE_PATH = ROOT / ".dashboard-state.json"
CONFIG_YAML = ROOT / "config.yaml"
CONFIG_JSON = ROOT / "dashboard-config.json"
DEFAULTS = {
    "business_type": "",
    "location": "",
    "limit": 10,
    "enrich_social": True,
    "include_prior": False,
}
QUALIFICATION = {
    "require_phone": True,
    "require_no_website": True,
    "exclude_chains": True,
}
CHAIN_HINTS = {
    "walmart", "target", "costco", "sam's club", "cvs", "walgreens", "starbucks",
    "mcdonald", "burger king", "subway", "dunkin", "chipotle", "panda express",
    "home depot", "lowe's", "ace hardware", "jiffy lube", "midas", "firestone",
    "massage envy", "hand and stone", "great clips", "sport clips", "supercuts",
}
SOCIAL_HOSTS = ("facebook.com", "instagram.com", "x.com", "twitter.com", "linkedin.com", "tiktok.com")
TEXT_SEARCH_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json"
DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"
DETAIL_FIELDS = ",".join([
    "place_id", "name", "formatted_address", "formatted_phone_number", "international_phone_number",
    "website", "rating", "user_ratings_total", "types", "business_status", "url", "opening_hours",
    "reviews", "photos", "geometry",
])


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def slugify(value: str, fallback: str = "search") -> str:
    value = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return value[:80] or fallback


def read_json(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return copy.deepcopy(default)


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def parse_simple_yaml(path: Path) -> dict[str, Any]:
    """Tiny key/value parser so the controller has no PyYAML dependency."""
    out: dict[str, Any] = {}
    if not path.exists():
        return out
    for raw in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw.split("#", 1)[0].strip()
        if not line or ":" not in line:
            continue
        key, val = line.split(":", 1)
        key = key.strip()
        val = val.strip().strip('"\'')
        if val.lower() in {"true", "false"}:
            out[key] = val.lower() == "true"
        else:
            try:
                out[key] = int(val)
            except ValueError:
                out[key] = val
    return out


def load_config() -> dict[str, Any]:
    config: dict[str, Any] = {}
    if CONFIG_YAML.exists():
        config.update(parse_simple_yaml(CONFIG_YAML))
    if CONFIG_JSON.exists():
        try:
            config.update(json.loads(CONFIG_JSON.read_text(encoding="utf-8")))
        except Exception as exc:
            config.setdefault("config_error", f"Could not parse {CONFIG_JSON.name}: {exc}")
    env_key = os.getenv("GOOGLE_PLACES_API_KEY") or os.getenv("GOOGLE_MAPS_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if env_key:
        config["api_key"] = env_key
    config.setdefault("monthly_request_limit", 5000)
    config.setdefault("max_calls_per_run", 250)
    for key, val in DEFAULTS.items():
        config.setdefault(key, val)
    return config


def load_state() -> dict[str, Any]:
    state = read_json(STATE_PATH, {})
    month = datetime.now(timezone.utc).strftime("%Y-%m")
    if state.get("usage_month") != month:
        state["usage_month"] = month
        state["requests"] = 0
    return state


def save_state(state: dict[str, Any]) -> None:
    write_json(STATE_PATH, state)


@dataclass
class SearchRequest:
    business_type: str
    location: str
    limit: int
    enrich_social: bool = True
    include_prior: bool = False

    @property
    def query(self) -> str:
        return f"{self.business_type} in {self.location}".strip()


def google_get(url: str, params: dict[str, Any], state: dict[str, Any], config: dict[str, Any]) -> dict[str, Any]:
    max_calls = int(config.get("max_calls_per_run") or 250)
    used = int(state.get("run_calls", 0) or 0)
    if used >= max_calls:
        raise RuntimeError(f"Stopped at max_calls_per_run={max_calls}")
    params = {k: v for k, v in params.items() if v not in (None, "")}
    full = url + "?" + urllib.parse.urlencode(params)
    request = urllib.request.Request(full, headers={"User-Agent": "leads-dashboard/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=30) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", "replace")[:500]
        raise RuntimeError(f"Google API HTTP {exc.code}: {body}") from exc
    state["run_calls"] = used + 1
    state["requests"] = int(state.get("requests", 0) or 0) + 1
    status = payload.get("status")
    if status not in {"OK", "ZERO_RESULTS"}:
        message = payload.get("error_message") or status or "unknown error"
        raise RuntimeError(f"Google API returned {status}: {message}")
    return payload


def is_probable_chain(name: str) -> bool:
    lower = name.lower()
    return any(hint in lower for hint in CHAIN_HINTS)


def primary_category(types: list[str]) -> str:
    if not types:
        return "Unknown"
    first = types[0].replace("_", " ").title()
    return first


def priority_score(place: dict[str, Any]) -> int:
    score = 45
    if place.get("formatted_phone_number") or place.get("international_phone_number"):
        score += 18
    if not place.get("website"):
        score += 20
    rating = float(place.get("rating") or 0)
    reviews = int(place.get("user_ratings_total") or 0)
    score += min(10, max(0, round((rating - 3.5) * 4)))
    if reviews >= 100:
        score += 7
    elif reviews >= 25:
        score += 4
    return max(0, min(100, score))


def normalize_place(place: dict[str, Any], request: SearchRequest, filename: str) -> dict[str, Any]:
    reviews = []
    for item in (place.get("reviews") or [])[:5]:
        reviews.append({
            "author": item.get("author_name") or "Google reviewer",
            "rating": item.get("rating"),
            "relative_time": item.get("relative_time_description") or "",
            "text": item.get("text") or "",
        })
    hours = place.get("opening_hours") or {}
    photo_names = []
    for photo in (place.get("photos") or [])[:10]:
        ref = photo.get("photo_reference")
        if ref:
            photo_names.append(ref)
    phone = place.get("formatted_phone_number") or place.get("international_phone_number") or ""
    return {
        "place_id": place.get("place_id") or "",
        "name": place.get("name") or "Unnamed place",
        "category": primary_category(place.get("types") or []),
        "types": place.get("types") or [],
        "address": place.get("formatted_address") or "",
        "phone": phone,
        "website": place.get("website") or "",
        "rating": place.get("rating") or 0,
        "review_count": place.get("user_ratings_total") or 0,
        "business_status": place.get("business_status") or "UNKNOWN",
        "google_maps_url": place.get("url") or "",
        "hours": {"weekdayDescriptions": hours.get("weekday_text") or []},
        "reviews": reviews,
        "photo_count": len(photo_names),
        "photo_names": photo_names,
        "social_links": {},
        "query": request.query,
        "priority_score": priority_score(place),
        "collected_at": utc_now(),
        "source_file": filename,
        "source_files": [filename],
    }


def existing_place_ids() -> set[str]:
    data = read_json(DATA_JSON, {"leads": []})
    return {lead.get("place_id") for lead in data.get("leads", []) if lead.get("place_id")}


def collect_places(request: SearchRequest, config: dict[str, Any], state: dict[str, Any]) -> dict[str, Any]:
    api_key = config.get("api_key") or config.get("google_places_api_key")
    if not api_key:
        raise RuntimeError("Missing Google Places API key. Add GOOGLE_PLACES_API_KEY or config.yaml api_key.")
    target = max(1, min(50, int(request.limit or 10)))
    prior_ids = existing_place_ids() if not request.include_prior else set()
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    filename = f"leads-{slugify(request.business_type)}-in-{slugify(request.location)}-{timestamp}.json"

    leads: list[dict[str, Any]] = []
    rejected: list[dict[str, Any]] = []
    raw_count = 0
    token: str | None = None
    state["run_calls"] = 0

    while len(leads) < target:
        if token:
            time.sleep(2.0)  # Google next_page_token activation delay.
        search_payload = google_get(TEXT_SEARCH_URL, {"query": request.query, "key": api_key, "pagetoken": token}, state, config)
        candidates = search_payload.get("results") or []
        raw_count += len(candidates)
        for candidate in candidates:
            place_id = candidate.get("place_id")
            name = candidate.get("name") or "Unknown"
            if not place_id:
                rejected.append({"place_id": "", "name": name, "reason": "missing place_id", "query": request.query, "file": filename})
                continue
            if place_id in prior_ids:
                rejected.append({"place_id": place_id, "name": name, "reason": "already in dashboard", "query": request.query, "file": filename})
                continue
            detail_payload = google_get(DETAILS_URL, {"place_id": place_id, "fields": DETAIL_FIELDS, "key": api_key}, state, config)
            detail = detail_payload.get("result") or {}
            if QUALIFICATION["exclude_chains"] and is_probable_chain(detail.get("name") or name):
                rejected.append({"place_id": place_id, "name": detail.get("name") or name, "reason": "probable chain", "query": request.query, "file": filename})
                continue
            if QUALIFICATION["require_phone"] and not (detail.get("formatted_phone_number") or detail.get("international_phone_number")):
                rejected.append({"place_id": place_id, "name": detail.get("name") or name, "reason": "missing phone", "query": request.query, "file": filename})
                continue
            if QUALIFICATION["require_no_website"] and detail.get("website"):
                rejected.append({"place_id": place_id, "name": detail.get("name") or name, "reason": "has website", "query": request.query, "file": filename})
                continue
            leads.append(normalize_place(detail, request, filename))
            prior_ids.add(place_id)
            if len(leads) >= target:
                break
        token = search_payload.get("next_page_token")
        if not token or len(leads) >= target:
            break

    batch = {
        "query": request.query,
        "target_leads": target,
        "collected_at": utc_now(),
        "live": True,
        "api_calls_used_this_run": int(state.get("run_calls", 0) or 0),
        "max_api_calls_per_run": int(config.get("max_calls_per_run") or 250),
        "monthly_request_limit": int(config.get("monthly_request_limit") or 5000),
        "monthly_requests_used": int(state.get("requests", 0) or 0),
        "monthly_usage_month": state.get("usage_month"),
        "rejected_count": len(rejected),
        "file": filename,
        "lead_count": len(leads),
        "rejected_count_actual": len(rejected),
    }
    return {"summary": {"generated_at": utc_now(), "query": request.query}, "batch": batch, "leads": leads, "rejected": rejected, "file": filename, "raw_count": raw_count}


def merge_dashboard_data(export: dict[str, Any]) -> dict[str, Any]:
    existing = read_json(DATA_JSON, {"summary": {}, "batches": [], "leads": [], "rejected": []})
    batches = list(existing.get("batches") or []) + [export["batch"]]
    rejected = list(existing.get("rejected") or []) + list(export.get("rejected") or [])
    by_id: dict[str, dict[str, Any]] = {}
    duplicate_count = 0
    for lead in list(existing.get("leads") or []) + list(export.get("leads") or []):
        pid = lead.get("place_id")
        if not pid:
            continue
        if pid in by_id:
            duplicate_count += 1
            merged_files = list(dict.fromkeys((by_id[pid].get("source_files") or [by_id[pid].get("source_file")]) + (lead.get("source_files") or [lead.get("source_file")]) ))
            by_id[pid].update({k: v for k, v in lead.items() if v not in (None, "", [])})
            by_id[pid]["source_files"] = [f for f in merged_files if f]
        else:
            by_id[pid] = lead
    leads = sorted(by_id.values(), key=lambda l: (int(l.get("priority_score") or 0), int(l.get("review_count") or 0)), reverse=True)
    data = {
        "summary": {
            "generated_at": utc_now(),
            "source_dir": str(OUTPUT_DIR),
            "file_count": len(batches),
            "lead_count": len(leads),
            "raw_lead_count": int((existing.get("summary") or {}).get("raw_lead_count") or 0) + int(export.get("raw_count") or len(export.get("leads") or [])),
            "duplicate_count": duplicate_count + int((existing.get("summary") or {}).get("duplicate_count") or 0),
            "rejected_count": len(rejected),
        },
        "batches": batches,
        "leads": leads,
        "rejected": rejected,
    }
    write_json(DATA_JSON, data)
    DATA_JS.write_text("window.LEADS_DASHBOARD_DATA = " + json.dumps(data, indent=2, ensure_ascii=False) + ";\n", encoding="utf-8")
    return data


class Controller:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.job: dict[str, Any] = {"status": "idle", "message": "Ready for a city or ZIP search."}

    def snapshot(self) -> dict[str, Any]:
        with self.lock:
            return copy.deepcopy(self.job)

    def set_job(self, **updates: Any) -> None:
        with self.lock:
            self.job.update(updates)

    def start(self, request: SearchRequest, config: dict[str, Any]) -> dict[str, Any]:
        with self.lock:
            if self.job.get("status") in {"queued", "running"}:
                raise RuntimeError("A lead search is already running.")
            job_id = datetime.now(timezone.utc).strftime("job-%Y%m%d-%H%M%S")
            self.job = {"id": job_id, "status": "queued", "query": request.query, "message": "Lead search queued."}
        thread = threading.Thread(target=self._run, args=(job_id, request, config), daemon=True)
        thread.start()
        return self.snapshot()

    def _run(self, job_id: str, request: SearchRequest, config: dict[str, Any]) -> None:
        state = load_state()
        try:
            self.set_job(status="running", message=f"Searching Google Places for {request.query}…")
            export = collect_places(request, config, state)
            OUTPUT_DIR.mkdir(exist_ok=True)
            out_path = OUTPUT_DIR / export["file"]
            write_json(out_path, {
                "summary": export["summary"],
                "batch": export["batch"],
                "leads": export["leads"],
                "rejected": export["rejected"],
            })
            merge_dashboard_data(export)
            save_state(state)
            count = len(export["leads"])
            self.set_job(
                status="success",
                message=f"Saved {count} qualified lead{'s' if count != 1 else ''} to {export['file']}.",
                json_file=export["file"],
                query=request.query,
                completed_at=utc_now(),
            )
        except Exception as exc:
            save_state(state)
            self.set_job(status="error", message=str(exc), error=str(exc), completed_at=utc_now())


CONTROLLER = Controller()


class Handler(SimpleHTTPRequestHandler):
    server_version = "LeadsDashboard/1.0"

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store" if self.path.startswith("/api/") else "no-cache")
        super().end_headers()

    def send_json(self, payload: Any, status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802
        path = urllib.parse.urlparse(self.path).path
        if path == "/api/status":
            config = load_config()
            state = load_state()
            api_key = config.get("api_key") or config.get("google_places_api_key")
            self.send_json({
                "server": {
                    "has_api_key": bool(api_key),
                    "config_error": config.get("config_error", ""),
                    "defaults": {k: config.get(k, v) for k, v in DEFAULTS.items()},
                    "qualification": QUALIFICATION,
                    "usage": {
                        "requests": int(state.get("requests", 0) or 0),
                        "monthly_limit": int(config.get("monthly_request_limit") or 5000),
                        "max_calls_per_run": int(config.get("max_calls_per_run") or 250),
                        "month": state.get("usage_month"),
                    },
                },
                "job": CONTROLLER.snapshot(),
            })
            return
        if path == "/api/data":
            self.send_json(read_json(DATA_JSON, {"summary": {}, "batches": [], "leads": [], "rejected": []}))
            return
        return super().do_GET()

    def do_POST(self) -> None:  # noqa: N802
        path = urllib.parse.urlparse(self.path).path
        if path != "/api/search":
            self.send_error(HTTPStatus.NOT_FOUND, "Unknown API endpoint")
            return
        try:
            length = int(self.headers.get("Content-Length") or "0")
            payload = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
            request = SearchRequest(
                business_type=str(payload.get("business_type") or "").strip(),
                location=str(payload.get("location") or "").strip(),
                limit=max(1, min(50, int(payload.get("limit") or 10))),
                enrich_social=bool(payload.get("enrich_social", True)),
                include_prior=bool(payload.get("include_prior", False)),
            )
            if not request.business_type or not request.location:
                raise ValueError("Business type and location are required.")
            config = load_config()
            if not (config.get("api_key") or config.get("google_places_api_key")):
                raise ValueError("Missing Google Places API key. Add config.yaml or GOOGLE_PLACES_API_KEY.")
            job = CONTROLLER.start(request, config)
            self.send_json({"job": job}, status=202)
        except Exception as exc:
            self.send_json({"error": str(exc)}, status=400)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Serve the local leads dashboard and Google Places search controller.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8140)
    args = parser.parse_args(argv)
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"Lead dashboard controller serving http://{args.host}:{args.port}/")
    print(f"Project root: {ROOT}")
    print("Add config.yaml with api_key before running live searches." if not (load_config().get("api_key") or load_config().get("google_places_api_key")) else "Google Places API key loaded.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping lead dashboard controller.")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
