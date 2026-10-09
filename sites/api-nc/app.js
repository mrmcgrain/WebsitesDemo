"use strict";

const $ = (selector) => document.querySelector(selector);
const resultElement = $("#result");
let trace = null;
let current = 0;
let busy = false;
let packetAnimation = null;

// This function is also the source displayed in the teaching panel.
async function requestEcho(message, mode, record) {
  // STAGE 1: the click starts this async function.
  record(1, "Click started the async function", { message });
  // STAGE 2: encode input into the request URL.
  const endpoint = mode === "http-error"
    ? "https://httpbin.org/status/404"
    : "https://httpbin.org/get";
  const url = new URL(endpoint);
  url.search = new URLSearchParams({ lesson: "API", message }).toString();
  record(2, "Prepared request URL", {
    url: mode === "no-data" ? "Local fixture (no network)" : url.href,
  });
  // STAGE 3: fetch returns a Promise; the browser handles HTTP.
  record(3, "Starting request or labeled fixture", { mode });
  const response = mode === "no-data"
    ? new Response('{"args":{}}', { status: 200 })
    : await fetch(url, { signal: AbortSignal.timeout(15000) });
  // STAGE 5: fetch resolves with response status and headers.
  record(5, "Response available", {
    status: response.status, ok: response.ok,
  });
  if (!response.ok) throw new Error(`The API returned HTTP ${response.status}.`);
  // STAGE 6: a separate Promise reads and parses the body.
  const data = await response.json();
  record(6, "Parsed response data", data);
  // STAGE 7: select a field using the actual object structure.
  const value = data?.args?.message;
  record(7, "Selected data.args.message", value);
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("No message. Inspect data.args.message.");
  }
  // STAGE 8: write the value to the page; the browser paints it.
  resultElement.textContent = value;
  record(8, "Updated the page", value);
  return data;
}

const stages = [
  { id: 1, title: "The click starts your code.", text: "The submit handler calls this async function with your message. Nothing has crossed the network yet.", node: "js", x: 105, y: 40, promise: "No network Promise yet", packet: "Input enters JavaScript" },
  { id: 2, title: "Turn input into a request URL.", text: "URLSearchParams encodes the message as a query parameter. This is the exact URL the browser will request.", node: "js", x: 190, y: 86, promise: "Ready to call fetch()", packet: "Message → query parameter" },
  { id: 3, title: "Send the request. Keep the Promise.", text: "fetch() returns a Promise in JavaScript. Browser networking sends the HTTP request. await pauses this function, while the browser can continue other work.", node: "browser", x: 309, y: 86, promise: "fetch Promise: pending", packet: "HTTP request travels outward" },
  { id: 4, title: "The API prepares its response.", text: "httpbin echoes the query parameters and request information. This server step is a conceptual illustration; we cannot observe its private execution from the browser.", node: "api", x: 512, y: 40, promise: "fetch Promise: pending", packet: "Server processing · illustrated" },
  { id: 5, title: "The response arrives at the browser.", text: "The fetch Promise fulfills when the response status and headers are available. The body may still be arriving. response.ok checks the HTTP status; fetch does not reject just because a server returns 404.", node: "browser", x: 309, y: 117, promise: "fetch Promise: fulfilled", packet: "Response status + headers" },
  { id: 6, title: "Read the body. Parse the JSON.", text: "response.json() returns a separate Promise. It reads the response body and parses JSON text into a JavaScript value. Expand the object in the real Console to inspect its shape.", node: "json", x: 309, y: 183, promise: "json() Promise: fulfilled", packet: "JSON text → JavaScript object" },
  { id: 7, title: "Follow the shape of the data.", text: "The message is nested inside args. Read data.args.message, not data.message. A successful network request does not guarantee that your code selected the right field.", node: "json", x: 407, y: 232, promise: "Selected value is available", packet: "data.args.message → display value" },
  { id: 8, title: "Put the value on the page.", text: "textContent writes the message into the result element safely. The browser paints that change. You have followed one value from input to request to response to screen.", node: "screen", x: 512, y: 183, promise: "Async function completes", packet: "Message rendered on the page" },
];

function format(value) {
  return value === undefined ? "undefined" : JSON.stringify(value, null, 2);
}

function record(stage, label, value) {
  // Capture snapshots so later mutations cannot rewrite replay history.
  const snapshot = value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const event = { stage, label, value: snapshot, elapsed: Math.round(performance.now() - trace.started) };
  trace.events.push(event);
  console.log(`[${stage}] ${label}`, snapshot);
  if (stage === 2) trace.url = snapshot.url;
  if (stage === 5) { trace.http = snapshot; trace.headersMs = event.elapsed; }
  if (stage === 6) trace.data = snapshot;
  if (stage === 7) trace.value = snapshot;
}

function explainError(error) {
  if (error.name === "TimeoutError") return "The API took longer than 15 seconds. Try again.";
  if (error instanceof TypeError) return "Could not reach the API. Check your connection and try again.";
  return error.message;
}

function renderCode(stage) {
  const lines = requestEcho.toString().split("\n");
  let activeStage = 0;
  const fragment = document.createDocumentFragment();
  lines.forEach((line, index) => {
    const marker = line.match(/STAGE (\d+)/);
    if (marker) activeStage = Number(marker[1]);
    const row = document.createElement("span");
    row.className = "code-line" + (activeStage === stage ? " active" : "");
    const number = document.createElement("span");
    number.className = "line-number";
    number.textContent = String(index + 1).padStart(2, "0");
    row.append(number, document.createTextNode(line || " "));
    fragment.append(row);
  });
  $("#code").replaceChildren(fragment);
  const active = $("#code .active");
  if (active) $("#code").scrollTop = Math.max(0, active.offsetTop - 25);
}

function renderLogs(stage, isError) {
  const visible = trace ? trace.events.filter(e => e.stage <= stage && (e.stage !== 9 || isError)) : [];
  $("#logs").replaceChildren();
  for (const event of visible) {
    const item = document.createElement("details");
    item.className = "log-entry" + (event.stage === 9 ? " log-error" : "");
    item.open = event.stage === stage;
    const summary = document.createElement("summary");
    summary.textContent = `[${event.stage === 9 ? "ERROR" : event.stage}] ${event.label} · +${event.elapsed} ms`;
    const data = document.createElement("pre");
    data.textContent = format(event.value);
    item.append(summary, data);
    $("#logs").append(item);
  }
  if (!visible.length) $("#logs").textContent = "The first clue starts with a click.";
  $("#logs").scrollTop = $("#logs").lastElementChild?.offsetTop || 0;
}

function renderStage() {
  const stage = trace ? trace.steps[current] : stages[0];
  const isError = stage.id === 9;
  const evidenceStage = isError ? trace.lastStage : stage.id;
  $("#previous").disabled = !trace || busy || current === 0;
  $("#next").disabled = !trace || busy || current === trace.steps.length - 1;
  $("#restart").disabled = !trace || busy;
  $("#step-count").textContent = trace ? `${String(current + 1).padStart(2, "0")} / ${String(trace.steps.length).padStart(2, "0")}` : "READY";
  $("#stage-kicker").textContent = isError ? "ERROR BOUNDARY" : `STAGE ${stage.id} / ${trace?.mode === "no-data" ? "LOCAL FIXTURE" : "TEACHING REPLAY"}`;
  $("#stage-title").textContent = stage.title;
  $("#explanation").textContent = stage.text;
  $("#packet-label").textContent = stage.packet;
  $("#promise-text").textContent = stage.promise;
  $("#promise").classList.toggle("pending", stage.id === 3 || stage.id === 4);
  $("#request-url").textContent = trace && evidenceStage >= 2 ? trace.url : "The request URL appears at step 2.";
  $("#request-method").textContent = trace?.mode === "no-data" ? "LOCAL" : "GET";
  $("#http-status").textContent = trace?.http && evidenceStage >= 5 ? `${trace.http.status} ${trace.http.ok ? "OK" : "ERROR"}` : "—";
  $("#http-status").classList.toggle("error-pill", Boolean(trace?.http && !trace.http.ok && evidenceStage >= 5));
  $("#timing").textContent = trace && (evidenceStage >= 5 || isError) ? `${trace.headersMs !== undefined ? `Headers ${trace.headersMs} ms · ` : ""}Complete ${trace.duration} ms${trace.mode === "no-data" ? " · local fixture" : " · actual network run"}` : "Actual duration appears when the replay reaches the response.";
  $("#response-body").textContent = trace && evidenceStage >= 6 && trace.data !== undefined ? format(trace.data) : "The parsed response appears at step 6.";
  resultElement.textContent = isError ? "No result. Request failed." : trace && stage.id === 8 ? trace.value : "Waiting for the render step…";
  $("#debug").disabled = busy || !trace || evidenceStage < 7 || trace.mode !== "live" || typeof trace.value !== "string";
  if ($("#debug").disabled) {
    $("#debug-example").hidden = true;
    $("#debug").setAttribute("aria-expanded", "false");
  }
  document.querySelectorAll(".node").forEach(node => node.classList.toggle("active", node.id === `node-${stage.node}`));
  packetAnimation?.cancel();
  const packet = $("#packet");
  const before = packet.getAttribute("transform");
  const target = `translate(${stage.x} ${stage.y})`;
  packet.setAttribute("transform", target);
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches && trace) {
    packetAnimation = packet.animate([{ transform: before.replace(/translate\((\d+) (\d+)\)/, "translate($1px, $2px)") }, { transform: `translate(${stage.x}px, ${stage.y}px)` }], { duration: 850, easing: "ease-in-out" });
  }
  packet.classList.toggle("error-packet", isError);
  // The external server has no source line in our function. We are still awaiting fetch.
  renderCode(evidenceStage === 4 ? 3 : evidenceStage);
  renderLogs(isError ? 9 : stage.id, isError);
  renderTrack();
}

function renderTrack() {
  $("#stage-track").replaceChildren();
  (trace?.steps || stages).forEach((stage, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = stage.id === 9 ? "!" : stage.id;
    button.title = stage.title;
    button.setAttribute("aria-label", `Stage ${stage.id}: ${stage.title}`);
    if (trace && index === current) button.setAttribute("aria-current", "step");
    button.disabled = !trace || busy;
    button.addEventListener("click", () => { current = index; renderStage(); });
    $("#stage-track").append(button);
  });
}

$("#request-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy) return;
  busy = true;
  $("#send").disabled = true;
  $("#mode").disabled = true;
  $("#debug-example").hidden = true;
  const mode = $("#mode").value;
  trace = { mode, captured: new Date(), started: performance.now(), events: [], steps: [], duration: 0 };
  current = 0;
  $("#status").textContent = mode === "no-data" ? "Running labeled local no-data fixture. No HTTP request." : "Live request running at normal speed…";
  $("#capture").textContent = "Recording this transaction";
  $("#stage-kicker").textContent = "RECORDING · NORMAL SPEED";
  $("#step-count").textContent = mode === "no-data" ? "LOCAL" : "LIVE";
  $("#promise-text").textContent = "Recording before replay";
  $("#promise").classList.remove("pending");
  $("#packet-label").textContent = "Waiting for the recorded trace";
  document.querySelectorAll(".node").forEach(node => node.classList.remove("active"));
  renderCode(0);
  $("#request-url").textContent = "Recording a new transaction…";
  $("#http-status").textContent = "—";
  $("#response-body").textContent = "Waiting for this response…";
  $("#timing").textContent = "Measuring this request…";
  $("#logs").textContent = "Recording events. The real Console receives them immediately.";
  $("#stage-title").textContent = "Recording the real transaction.";
  $("#explanation").textContent = "The browser runs at normal speed. When it finishes, you can replay the captured steps slowly.";
  resultElement.textContent = "Waiting for the API…";
  $("#next").disabled = $("#previous").disabled = $("#restart").disabled = $("#debug").disabled = true;
  renderTrack();
  try {
    await requestEcho($("#message").value, mode, record);
    $("#status").textContent = "Live response recorded. Click Next step to slow down the story.";
  } catch (error) {
    trace.error = explainError(error);
    console.error("[ERROR] Request failed", trace.error);
    trace.events.push({ stage: 9, label: "Request failed", value: trace.error, elapsed: Math.round(performance.now() - trace.started) });
    $("#status").textContent = `Request failed: ${trace.error} Replay shows the failure boundary.`;
  } finally {
    trace.duration = Math.round(performance.now() - trace.started);
    trace.lastStage = Math.max(...trace.events.filter(e => e.stage !== 9).map(e => e.stage));
    trace.steps = stages.filter(stage => stage.id <= trace.lastStage && !(mode === "no-data" && stage.id === 4));
    if (mode === "no-data") trace.steps = trace.steps.map(stage => ({
      ...stage,
      text: stage.id === 3 ? "This explicitly labeled local fixture constructs a Response in memory. It does not call fetch or contact a server." : stage.id === 5 ? "This Response was constructed locally, with status 200. No fetch Promise or HTTP transaction occurred." : stage.id === 2 ? "The fixture uses a local Response object. The URL is constructed by the shared function but is never requested." : stage.text,
      promise: stage.id === 3 || stage.id === 5 ? "Local fixture · no fetch Promise" : stage.promise,
      packet: stage.id === 3 || stage.id === 5 ? "Fixture stays inside this browser" : stage.packet,
      node: stage.id === 3 || stage.id === 5 ? "js" : stage.node,
      x: stage.id === 3 || stage.id === 5 ? 105 : stage.x,
      y: stage.id === 3 || stage.id === 5 ? 40 : stage.y,
    }));
    if (trace.error) trace.steps.push({ id: 9, title: "Find the boundary that failed.", text: trace.error + " Compare the last successful log with the next operation. No value was rendered.", node: "js", x: 105, y: 40, promise: "Error handled · controls restored", packet: "Error caught by the submit handler" });
    busy = false;
    $("#send").disabled = $("#mode").disabled = false;
    $("#capture").textContent = `Captured ${trace.captured.toLocaleTimeString("en-US", { timeZone: "America/Phoenix" })} Phoenix`;
    $("#replay-label").textContent = mode === "no-data" ? "Teaching replay of a LOCAL fixture. No network request." : "Teaching replay of the last real request. Animation timing is illustrative.";
    renderStage();
  }
});

$("#next").addEventListener("click", () => { if (trace && current < trace.steps.length - 1) { current++; renderStage(); } });
$("#previous").addEventListener("click", () => { if (trace && current > 0) { current--; renderStage(); } });
$("#restart").addEventListener("click", () => { current = 0; renderStage(); });
document.addEventListener("keydown", event => {
  if (event.target.closest("input, select, textarea, pre, #logs") || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
    const button = $(event.key === "ArrowRight" ? "#next" : "#previous");
    if (!button.disabled) { event.preventDefault(); button.click(); }
  }
});
$("#debug").addEventListener("click", () => {
  $("#debug-example").hidden = !$("#debug-example").hidden;
  $("#debug").setAttribute("aria-expanded", String(!$("#debug-example").hidden));
  $("#wrong-value").textContent = format(trace.data.message);
  $("#right-value").textContent = format(trace.data.args.message);
  $("#debug-explanation").textContent = "The response is valid. The wrong path returns undefined. Inspect args in panel 03, then correct the field path. This is an intentional teaching example, not a failed live request.";
  if (!$("#debug-example").hidden) $("#debug-example").scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
});
renderCode(0);
renderTrack();
