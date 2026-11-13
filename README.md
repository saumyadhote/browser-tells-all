# What Your Browser Tells Websites

A privacy-awareness tool that shows you **how a tracker sees you**. It reads the signals any website gets from your browser without asking, then does what trackers do with them: it combines weak clues into conclusions about you (your likely device model, country, desk setup and hardware age) and **shows the evidence and a confidence level for every guess**.

Everything runs in your browser. No backend, no build step, no framework, no third-party code, and a Content-Security-Policy that blocks network connections outright.

**Live demo:** https://saumyadhote.github.io/browser-tells-all/

The page is styled like a macOS Terminal window using the "Homebrew" profile, with output written like a command-line tool.

## What it infers

| Inference | Example output | How |
|---|---|---|
| **Device model** | `MacBook Air 13.6" (2022 or later) with Apple M2` | WebGL GPU name + screen size + pixel ratio, matched against tables of default display settings per model |
| | `Samsung Galaxy S23 Ultra (SM-S918B)` | Chromium's User-Agent Client Hints hand any script the exact model code; Samsung codes are decoded |
| | `iPhone 14 Pro, 15, 15 Pro or 16` | Safari hides the GPU, so the portrait screen size at 3x narrows it to a few models |
| | `a Windows 11 laptop with NVIDIA RTX 30-series` | "Laptop" in the GPU name, Windows' default display scaling for laptop panels, touch support; `platformVersion` ≥ 13 means Windows 11 |
| **Location (no IP address)** | `India`, `United States (US West Coast)` | Time zone → country table, cross-checked against your language list. `en-US` is treated as weak evidence because it's the worldwide default |
| **Background** | `Portuguese speaker living in or visiting Germany` | Language and time zone point to different countries |
| **Desk setup** | `a single screen, Dock auto-hidden, browser maximised` | `screen.isExtended`, the space the Dock/taskbar reserves (`screen` vs `availWidth/Height`), window size vs screen size |
| **Hardware age** | `bought around 2022–2023` | GPU generation → release window |

Each inference returns `{ value, confidence, evidence[] }`. The page shows the evidence under **why?**. When clues conflict (say a screen size that only existed on Intel Macs alongside an Apple Silicon GPU), confidence drops and the evidence says why. When the browser hides a signal, the engine says so instead of guessing.

## How rare is your browser?

Each signal's value gets a rough share `p` (the fraction of web users who share it). That share becomes `-log2(p)` bits: a value half of all users share is worth 1 bit, and one in a thousand is about 10 bits.

Adding the bits up naively says almost everyone is "1 in 8 billion", because many signals describe the same thing. A MacBook Air always has a MacBook Air screen, GPU and core count. So signals are grouped (device, locale, everything else). Within a group the strongest signal counts in full and the rest count at 25%. This lands typical browsers near the ~18 bits that large studies (Panopticlick, AmIUnique) measured for real users. The page shows both the raw sum and the corrected total.

The shares in `data.js` are rough, rounded global web-usage figures. Read the result as "common vs. rare", not as a measurement.

## Raw signals (21)

Screen size and pixel ratio, usable screen area, window size, multiple monitors, color depth, time zone, languages, OS, browser, User-Agent Client Hints (model, OS version, CPU architecture), CPU cores, device memory, touch support, color scheme, reduced motion, connection type, Do Not Track, Global Privacy Control, cookies, canvas fingerprint hash, and WebGL GPU name.

If an API isn't supported, the page shows "not available in your browser". It never shows an error.

## Privacy statement

- All values are read, inferred and displayed locally. Nothing is sent, stored or logged.
- No analytics, cookies, CDN fonts, external scripts or images.
- A Content-Security-Policy `<meta>` tag (`connect-src 'none'`, `default-src 'none'`) makes the browser itself block any network connection the page might try to make.
- **IP address and IP-based location are not used.** Reading them would need an external server. Every site you visit does see your IP address, though.

## Run locally

```bash
git clone https://github.com/saumyadhote/browser-tells-all.git
cd browser-tells-all
open index.html   # or double-click index.html
```

## Project structure

```
index.html   the terminal window: --whoami, --rarity, --raw, man fingerprinting
style.css    Homebrew-terminal theme, responsive grid
data.js      lookup tables: Apple/iPhone/iPad screens, Samsung model codes,
             GPU release eras, time zone → country, language → country, usage shares
infer.js     the inference engine: pure functions over a facts object, no DOM
script.js    collects raw facts from browser APIs and renders everything
```

`infer.js` has no DOM access, so you can test it in Node by loading `data.js` and `infer.js` into a `vm` context and passing in fake facts.

## Limitations

- Device tables assume **default display scaling**. If you changed it, the model match fails and the engine says the model is unclear.
- The tables cover common models, not every device. New models need new rows in `data.js`.
- Client Hints (model, OS version) only exist in Chromium browsers.
- Browsers with fingerprinting protection (Tor Browser, Brave, Firefox resist-fingerprinting, Safari) mask the GPU, round the screen or report UTC. That's the protection working, and the page reports it.
- The rarity estimate uses rough shares and a crude overlap correction.
- Real trackers use many more signals (fonts, audio, many WebGL parameters) plus your IP address.

## Roadmap

- A stable fingerprint ID you can compare in a private window, to show that tracking survives clearing cookies.
- Font detection, to infer installed software (Office, Adobe, developer tools).
- Per-browser fixes, with a re-check button.
- Automated tests for `infer.js` in GitHub Actions.

## License

[MIT](LICENSE)
