# 🍐 Pear Browser

pearOS's own browser: **Qt6 WebEngine (Chromium engine)** with a **fully custom
macOS-style interface we design** — replacing Seafari/Epiphany.

## Why this architecture
Browser = engine + shell. The engine (page rendering) is Chromium via
QtWebEngine — same engine as Chrome/Edge/Brave, ~zero compatibility issues.
The shell (everything you see and feel) is 100% ours to design.

## What's implemented (v0.1)
- **UI**: dark macOS chrome, traffic lights, rounded omnibox, floating tabs,
  thin blue progress strip, start page
- **Tabs**: create/close/move, per-tab titles, `Ctrl+T/W/L`, `F5`
- **Smart omnibox**: `QUrl::fromUserInput` — type words → search, type a
  domain → https
- **Speed & privacy (the real optimizations)**:
  - Ad/tracker requests blocked at the network layer **before DNS** — 35+
    networks (doubleclick, taboola, outbrain, criteo, analytics…) — this is
    the biggest page-load win
  - Single shared Chromium profile: one 512 MB HTTP disk cache for all tabs
  - GPU rasterization + zero-copy rendering, VA-API hardware video decode
  - Scroll animations, JS popup hijack disabled

## Build (Arch / pearOS)
```bash
sudo pacman -S qt6-base qt6-webengine cmake ninja
cmake -B build -S . -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build build
./build/pear-browser
# or build the package:  makepkg -sf
```

## Roadmap
1. Real traffic-light buttons wired to minimize/maximize/close (frameless window + custom drag)
2. History + bookmarks + downloads UI (SQLite via profile API)
3. Find-in-page, zoom per site, reader mode
4. Notch integration (toolbar extends behind the pearos-notch)
5. Chromium extension support evaluation, sync, profile per workspace

## Honest limitations
- No sandboxed *engine-level* innovations — engine is upstream Chromium
  (updated by Qt releases). That's the trade-off for full web compatibility.
- Ad-block is domain-based (not cosmetic filtering like uBlock's element
  hiding); cosmetic rules can be added later via an injected JS stylesheet.
