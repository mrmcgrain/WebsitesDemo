#!/usr/bin/env python3
"""Static acceptance checks for the separate Miss Debrah Rose refactor demo."""
from html.parser import HTMLParser
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "sites" / "mistress-rose-premium-refactor"


class AuditParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags = []
        self.text = []

    def handle_starttag(self, tag, attrs):
        self.tags.append((tag, dict(attrs)))

    def handle_data(self, data):
        self.text.append(data)


def require(condition, message, failures):
    if not condition:
        failures.append(message)


def main():
    failures = []
    index = SITE / "index.html"
    require(index.exists(), "refactor index.html exists", failures)
    if not index.exists():
        print("FAIL: " + failures[0])
        return 1

    html = index.read_text(encoding="utf-8")
    parser = AuditParser()
    parser.feed(html)
    tags = parser.tags
    text = " ".join(parser.text).lower()

    require((SITE / "styles.css").exists(), "local styles.css exists", failures)
    require((SITE / "app.js").exists(), "local app.js exists", failures)
    require("placeholder" not in text, "no visible placeholder copy", failures)
    require("fictional" not in text, "no fictional testimonial disclaimer", failures)
    require(not any(a.get("href") == "#" for t, a in tags if t == "a"), "no dead href=# links", failures)

    submit_buttons = [a for t, a in tags if t == "button" and a.get("type") == "submit"]
    require(len(submit_buttons) == 1, "exactly one real form submit button", failures)

    gallery_items = [a for t, a in tags if "data-gallery-item" in a]
    require(len(gallery_items) == 6, "gallery contains exactly six curated items", failures)

    images = [a for t, a in tags if t == "img"]
    hero = [a for a in images if "data-hero" in a]
    require(len(hero) == 1, "one hero image is identified", failures)
    if hero:
        require(hero[0].get("loading") == "eager", "hero image loads eagerly", failures)
        require(hero[0].get("fetchpriority") == "high", "hero image has high fetch priority", failures)
    below_fold = [a for a in images if "data-hero" not in a]
    require(bool(below_fold), "below-fold images exist", failures)
    require(all(a.get("loading") == "lazy" for a in below_fold), "all below-fold images lazy-load", failures)

    faq_buttons = [a for t, a in tags if t == "button" and "faq-trigger" in a.get("class", "").split()]
    require(bool(faq_buttons), "FAQ controls exist", failures)
    require(all(a.get("aria-expanded") in {"true", "false"} and a.get("aria-controls") for a in faq_buttons),
            "FAQ controls expose expanded state and controlled panel", failures)

    age_dialogs = [a for t, a in tags if a.get("role") == "dialog" and a.get("aria-modal") == "true"]
    require(len(age_dialogs) == 1, "age gate uses one modal dialog", failures)
    main_targets = [a for t, a in tags if t == "main" and a.get("id") == "main"]
    require(len(main_targets) == 1 and main_targets[0].get("tabindex") == "-1",
            "main content is a programmatic focus target after age confirmation", failures)

    if failures:
        for failure in failures:
            print("FAIL:", failure)
        return 1
    print("PASS: all static refactor acceptance checks")
    return 0


if __name__ == "__main__":
    sys.exit(main())
