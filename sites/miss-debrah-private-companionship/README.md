# Miss Debrah Website Preview

A static, client-ready adult companion website preview built from the supplied Google Drive media and Tryst/resource intake.

## Local development

```bash
cd /h/HermesProjects/miss-debrah-site
python -m http.server 4177
```

Then open `http://127.0.0.1:4177/`.

## Content and source notes

- Client-provided media copied from Google Drive into `assets/source/`.
- Web-facing derivatives are in `assets/gallery/` and `assets/video/`.
- HEIC files were converted to JPG for browser compatibility.
- Public page copy is intentionally polished and toned down from source profile language.
- The contact helper is local-only; it creates copyable inquiry text and does not submit data.
- The page is marked `noindex, nofollow` because this is a preview.

## Implementation notes

- Static HTML/CSS/JS: no build step required.
- Accessible age gate, skip link, labeled form controls, keyboard-operable accordions, and keyboard-closable gallery lightbox.
- Motion is progressive enhancement and respects `prefers-reduced-motion`.
- The visible site avoids source/audit wording and does not expose Drive links.
