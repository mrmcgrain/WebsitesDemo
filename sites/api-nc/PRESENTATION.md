# Three-minute presenter guide

## Before class

Start the local server using README.md. Open the app at 1440×900 or larger if possible. Make one live request before presenting to check connectivity. Keep the experiment on Live echo. Have actual DevTools ready, with Network filtered to httpbin. You can press F12 briefly during the lesson; closing it returns the full four-panel layout.

No review or rehearsal is claimed on your behalf. Practice this script once and trim any phrasing you do not use naturally.

## 0:00–0:15 · Send

“AI can write this request for me. Understanding the data helps me debug what it wrote. I'll send ‘Hello class’ to a real API. It echoes my message back.”

Click Send. Let the request finish. Explain that the real request is fast and the screen replays its recorded steps slowly.

## 0:15–1:45 · Follow one message

- Stage 1: “The click starts our async function. Here is the exact code.”
- Stage 2: “Our input becomes a query parameter. This is the URL we actually requested.”
- Stage 3: “fetch gives JavaScript a Promise. The browser sends HTTP. The Promise stays here. await pauses this function; the browser can still work.”
- Stage 4: “The API prepares its echo response. This server view is an illustration. We cannot inspect its internal execution from our browser.”
- Stage 5: “We have the response status and headers. We check the status ourselves. A 404 does not automatically reject fetch.”
- Stage 6: “Reading the body is another asynchronous step. response.json() reads it and parses JSON into a JavaScript object.”
- Stage 7: “Our message is inside args. The structure tells us which property to read.”
- Stage 8: “textContent updates the page. The browser displays the result.”

Point to the highlighted code and the newly revealed evidence as you advance. The labels in the logs mark boundaries; the timestamps show actual timing, not animation time.

## 1:45–2:30 · Debug the assumption

Click Try the wrong-field example.

“The request succeeded. But data.message is undefined. Our assumption was wrong. Inspect the response: the correct path is data.args.message. Know the shape of your data before you use it.”

Explain the one-line change. This deliberately broken example is for teaching, not a claim that Codex accidentally made this mistake.

## 2:30–3:00 · Verify and fail gracefully

Briefly open actual Network and Console. Point to the matching HTTP response and numbered events. Built-in panels replay our app's observations; DevTools provides the independent browser view.

If time permits, select Live HTTP 404, Send, and jump to the error stage. The app reports failure without crashing.

“The useful debugging question is: at which boundary did the value stop matching what I expected?”

## Explain a real agent change

The result-display checkpoint added `textContent`, missing-field validation, and readable failures. You can show that diff and explain why each change was needed.

Two real implementation issues were caught: a missing favicon added Console noise, and active code initially failed to scroll into view. Both were corrected and verified. Do not claim you personally caught or reviewed them unless you did.
