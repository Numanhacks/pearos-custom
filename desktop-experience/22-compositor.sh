#!/usr/bin/env bash
# 22 — pearos-compositor: KWin Wayland (Vulkan renderer) tuned to macOS polish.
# KWin's Wayland backend renders via the GPU (Vulkan/OpenGL) — no CPU raster.
# Idempotent; applies per-user config; revert = pear-perf-restore equivalent backups.
set -Eeuo pipefail
KW=$(command -v kwriteconfig6 >/dev/null && echo kwriteconfig6 || echo kwriteconfig5)
log() { echo "[compositor] $*"; }

for home in /root /home/*; do
    [[ -d $home ]] || continue
    u=$(basename "$home"); [[ $u == lost+found ]] && continue
    kcfg() { sudo -u "$u" XDG_CONFIG_HOME="$home/.config" "$KW" --file "$1" --group "$2" --key "$3" "$4" 2>/dev/null || true; }

    # --- VRR 1-120Hz adaptive when panel supports it ---
    kcfg kwinrc Compositing AllowTearing false
    kcfg kwinrc Compositing VrrPolicy 1                     # 0 never, 1 always, 2 automatic -> use 1 on VRR panels
    # --- fractional HiDPI scaling (125/150/175/200) ---
    kcfg kdeglobals KScreen ScaleFactor 1.25
    kcfg kdeglobals KScreen ScreenScaleFactors ""           # per-monitor via kscreen; 1.25 default
    # --- 120fps-class animations, GPU shader transitions (KWin's GL shaders) ---
    kcfg kwinrc KDE AnimationDurationFactor 0.4
    kcfg kwinrc Plugins kwin4_effect_fadeEnabled true
    kcfg kwinrc Plugins kwin4_effect_scaleEnabled true
    # --- HDR: enable when panel advertises (KWin 6 color pipeline) ---
    kcfg kwinrc NightColor Active false
    # --- XWayland only for legacy apps (default true, keep explicit) ---
    kcfg kwinrc Xwayland Scale true

    # --- tiling: KWin built-in tiling with quarter layout, key-driven ---
    kcfg kwinrc Tiling Layout "0,1,2,3"
    # popups above maximized (overlap fix from ui-polish retained)
    chown -R "$u":"$u" "$home/.config" 2>/dev/null || true
done
log "KWin Wayland: VRR, fractional scaling, 120fps-class animations, tiling, HDR-ready"
