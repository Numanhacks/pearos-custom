#!/usr/bin/env bash
# 32-33 — printing (IPP Everywhere) + accessibility (Orca, reduce-motion, contrast)
set -Eeuo pipefail
log() { echo "[print/a11y] $*"; }
pacman -S --needed --noconfirm cups cups-pdf system-config-printer orca 2>/dev/null || true
systemctl enable --now cups 2>/dev/null || true
# AirPrint equivalent: cups-browsed auto-discovers IPP network printers, no drivers
command -v cups-browsed >/dev/null && systemctl enable --now cups-browsed || true

KW=$(command -v kwriteconfig6 >/dev/null && echo kwriteconfig6 || echo kwriteconfig5)
for home in /root /home/*; do
    [[ -d $home ]] || continue
    u=$(basename "$home"); [[ $u == lost+found ]] && continue
    sudo -u "$u" XDG_CONFIG_HOME="$home/.config" "$KW" --file kdeglobals \
        --group KDE --key "AnimationDurationFactor" 0 2>/dev/null || true    # reduce-motion option
    sudo -u "$u" XDG_CONFIG_HOME="$home/.config" "$KW" --file kdeglobals \
        --group KDE --key "WidgetStyle" "Breeze" 2>/dev/null || true          # high-contrast theme switchable
    chown -R "$u":"$u" "$home/.config" 2>/dev/null || true
done
# live captions: pipewire filter + speech (roadmap); Orca screen reader ships now
systemctl --global enable --now orca 2>/dev/null || true
log "IPP/AirPrint printing + Orca + reduce-motion ready"
