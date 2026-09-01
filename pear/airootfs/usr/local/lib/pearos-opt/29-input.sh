#!/usr/bin/env bash
# 29 — input: libinput touchpad (macOS gestures), palm rejection OS-wide,
# instant keyboard layout, compose keys. Surface touchpads are libinput-native.
set -Eeuo pipefail
KW=$(command -v kwriteconfig6 >/dev/null && echo kwriteconfig6 || echo kwriteconfig5)
log() { echo "[input] $*"; }
for home in /root /home/*; do
    [[ -d $home ]] || continue
    u=$(basename "$home"); [[ $u == lost+found ]] && continue
    kc() { sudo -u "$u" XDG_CONFIG_HOME="$home/.config" "$KW" --file "$1" --group "$2" --key "$3" "$4" 2>/dev/null || true; }
    # touchpad: natural scroll, tap-click, palm rejection via libinput (default dwt)
    kc kcminputrc LibInput/Touchpad NaturalScroll true
    kc kcminputrc LibInput/Touchpad TapToClick true
    kc kcminputrc LibInput/Touchpad DisableWhileTyping true          # palm rejection at OS level
    # three/four finger swipe = workspace/overview (KWin default gestures)
    kc kwinrc TouchpadGestures ThreeFingerSwipeLeft true
    # instant layout switching (no reboot — xkb applies live)
    kc kxkbrc Layout DisplayNames ""
    kc kxkbrc Layout Options compose:ralt                            # compose key
    chown -R "$u":"$u" "$home/.config" 2>/dev/null || true
done
log "libinput gestures + palm rejection + compose key configured"
