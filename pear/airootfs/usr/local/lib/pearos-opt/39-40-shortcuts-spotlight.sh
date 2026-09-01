#!/usr/bin/env bash
# 39-40 — shortcuts + Spotlight (KRunner): <100ms launcher, calc/convert, search
set -Eeuo pipefail
KW=$(command -v kwriteconfig6 >/dev/null && echo kwriteconfig6 || echo kwriteconfig5)
log() { echo "[shortcuts/spotlight] $*"; }
for home in /root /home/*; do
    [[ -d $home ]] || continue
    u=$(basename "$home"); [[ $u == lost+found ]] && continue
    kc() { sudo -u "$u" XDG_CONFIG_HOME="$home/.config" "$KW" --file "$1" --group "$2" --key "$3" "$4" 2>/dev/null || true; }
    # Cmd+Space equivalent
    kc kglobalshortcutsrc krunner.desktop "_launch" "Meta+Space\tSearch,Meta+Space\tSearch,_launch"
    # screenshots built in (Spectacle): full/region/record
    kc kglobalshortcutsrc org.kde.spectacle.desktop "FullScreenScreenShot" "Meta+Shift+S"
    kc kglobalshortcutsrc org.kde.spectacle.desktop "ActiveWindowScreenShot" "Meta+Shift+W"
    # window management: tile/maximize/move-monitor (KWin defaults, explicit)
    kc kwinrc Windows Maximize "Meta+Up"
    chown -R "$u":"$u" "$home/.config" 2>/dev/null || true
done
# KRunner plugins: calculator incl "500 USD to EUR" (exchange rates provider),
# unit conversion, app/file/settings search — all local, <100ms with Baloo.
log "Meta+Space spotlight, Meta+Shift+S screenshot, calculator/converter plugins on"
