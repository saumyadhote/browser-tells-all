# What Your Browser Tells Websites

A single-page privacy-awareness tool. Open it and it shows what any website can learn about your browser and device instantly, without asking, and explains in plain English how each signal is used for tracking.

Everything runs in your browser. There is no backend, no build step, no framework and no third-party code.

**Live demo:** _link added after deployment_

## Signals shown (18)

| # | Signal | Identifiability | Source API |
|---|--------|-----------------|------------|
| 1 | Screen size & pixel ratio | Medium | `screen.width/height`, `devicePixelRatio` |
| 2 | Browser window size | Medium | `innerWidth/innerHeight` |
| 3 | Color depth | Low | `screen.colorDepth` |
| 4 | Time zone (and UTC offset) | Medium | `Intl.DateTimeFormat().resolvedOptions()` |
| 5 | Languages | Medium | `navigator.languages` |
| 6 | Platform / OS | Low | `navigator.userAgentData` or `navigator.platform` |
| 7 | Browser & version | Medium | `navigator.userAgentData` or user-agent string |
| 8 | CPU cores | Medium | `navigator.hardwareConcurrency` |
| 9 | Device memory | Low | `navigator.deviceMemory` (Chromium only) |
| 10 | Touch support | Low | `navigator.maxTouchPoints` |
| 11 | Color scheme preference | Low | `prefers-color-scheme` media query |
| 12 | Reduced-motion preference | Low | `prefers-reduced-motion` media query |
| 13 | Connection type | Low | `navigator.connection` (mostly Chromium) |
| 14 | Do Not Track | Low | `navigator.doNotTrack` |
| 15 | Global Privacy Control | Low | `navigator.globalPrivacyControl` |
| 16 | Cookies enabled | Low | `navigator.cookieEnabled` |
| 17 | Canvas fingerprint hash | High | Canvas 2D drawing + `toDataURL()`, hashed with FNV-1a |
| 18 | Graphics card (WebGL) | High | WebGL `RENDERER` / `WEBGL_debug_renderer_info` |

If an API is not supported in the visitor's browser, the card shows **"Not available in your browser"** instead of an error.

The Low/Medium/High tags are my own judgement of how much each signal tends to narrow down a visitor on its own. They are not measured values.

## How the uniqueness meter works

The meter is a **heuristic estimate, not a measurement**.

1. Each signal has a weight based on its tag: Low = 1 point, Medium = 2, High = 3.
2. A signal earns its points if the browser exposes a value for it.
3. Score = earned points ÷ maximum possible points × 100, rounded.

With the current 18 signals the maximum is 28 points (10 Low, 6 Medium, 2 High). Bands: under 40 is "Lower exposure", 40 to 74 is "Moderate", 75 and above is "High".

What this means: the score reflects **how much your browser exposes**, not how rare your values are. A browser that hides device memory, connection type and the GPU name scores lower than one that exposes all of them. Measuring real uniqueness would mean comparing your values against many other visitors, which needs a server and a dataset, and this project deliberately has neither.

The logic is in `calculateScore()` in `script.js`.

## Privacy statement

- All values are read and displayed locally. Nothing is sent, stored or logged.
- No analytics, cookies, CDN fonts, external scripts or images.
- A Content-Security-Policy `<meta>` tag (`connect-src 'none'`, `default-src 'none'`) makes the browser itself block any network connection the page might try to make.
- **IP address and location are not shown.** A web page cannot read its own visitor's IP address without asking an external server, and that would break the "nothing leaves your browser" promise. Keep in mind that every site you visit does see your IP address.

## Run locally

No install or build needed.

```bash
git clone https://github.com/saumyadhote/browser-tells-all.git
cd browser-tells-all
open index.html   # or double-click index.html
```

Opening the file directly works. Some values (such as cookies) can behave slightly differently on `file://` than on a real website.

## Project structure

```
index.html   page structure, "Why this matters" and "How to reduce" sections
style.css    layout, light/dark theme via CSS variables, responsive grid
script.js    one function per signal, SIGNALS list, scoring, rendering
```

## Limitations

- The uniqueness score is a heuristic. It does not know how common your values are.
- Browser support varies. Device memory and connection type are mostly Chromium-only, Global Privacy Control only exists in some browsers, and Safari has removed Do Not Track.
- Browsers with fingerprinting protection (Tor Browser, Brave, Firefox and Safari in some modes) may add noise to the canvas, so the canvas hash can change between page loads. That is the protection working.
- Browser and version detection relies on user-agent data, which browsers are intentionally reducing and which can be spoofed.
- Real trackers use many more signals (installed fonts, audio processing, many WebGL parameters and more). This page shows a representative subset.

## Roadmap

- Add a few more signals, such as audio-context fingerprinting and font detection.
- A "copy my results" button so people can compare browsers side by side.
- A short explainer for each browser's built-in fingerprinting protection.
- Automated checks with a headless browser in GitHub Actions.

## License

[MIT](LICENSE)
