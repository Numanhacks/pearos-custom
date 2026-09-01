# pearOS UI Fixes & macOS Theming Kit

Fixes for: buggy/overlapping interface + "Wi-Fi popup doesn't look like macOS".

## What each fix does

### 1. Notch overlap — `pkgbuilds/pearos-notch/src/NotchWindow.{h,cpp}`
**Root cause:** the notch set `_NET_WM_WINDOW_TYPE_DOCK` but never set a strut,
so on X11 maximized/fullscreen windows slid under and collided with it.
(Wayland was already safe via layer-shell.)

**Fix:** new `updateX11Strut()` sets `_NET_WM_STRUT` + `_NET_WM_STRUT_PARTIAL`
over exactly the notch's strip (collapsed height + gap, notch x-range).
KWin now reserves that space — windows can never overlap the notch, exactly
like macOS menu-bar behavior. Called on show and after every reposition.

Rebuild: `cd pkgbuilds/pearos-notch && make` (Arch) or build the package.

### 2. Glitchy behavior — `pear-ui-polish.sh`
- Disables the KWin effects that cause the artifacts (slide-under-panel,
  translucency overrides, zoom, dim screen) while keeping blur/fade/scale.
- 2x faster animation timing (macOS snappiness).
- Window rules: `plasmashell` popups and `pearos-notch` are forced
  above-by-default, so notifications and the Wi-Fi popup never hide behind
  maximized windows.

### 3. "Wi-Fi popup looks like Windows" — `pear-ui-polish.sh`
**Root cause:** pearOS themes icons/wallpapers but leaves the Plasma theme and
widget style stock Breeze — so the network/systray popups render like generic
KDE. **Fix:** installs **WhiteSur KDE** (look-and-feel + Plasma theme) and the
**WhiteSur Kvantum** app style system-wide, then configures every user to use
them. The network popup, systray menus, notifications and app dialogs all
render in the macOS frosted style afterward.

## Usage
```bash
sudo ./pear-ui-polish.sh            # apply
sudo ./pear-ui-polish.sh --revert   # restore previous configs
```
Idempotent; per-user configs backed up to `/var/lib/pear-ui-polish/backup`.

## Notes / honest limitations
- Test the result in a VM session — theme IDs (`com.github.vinceliuice.WhiteSur-dark`)
  are pinned to WhiteSur's install layout; if upstream renames them, adjust the
  two `LookAndFeelPackage`/`Theme name` lines.
- The dock (`pearos-dock/layout-templates/contents/layout.js`) uses
  `dodgewindows` — that IS macOS-like (windows can't cover the dock); we left
  it. If you still see dock flicker, try `panel.hiding = "windowscover"`.
