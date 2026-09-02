#!/usr/bin/env bash
# ============================================================================
# pearos-preload.sh — warm the page cache with hot desktop binaries and
# shared libraries so first app launches feel instant (macOS-style "everything
# is already in memory"). Runs once at boot, ionice idle class + nice 19 so it
# NEVER competes with the user.
# ============================================================================
set -u
IONICE="ionice -c 3"   # idle I/O class; service also runs nice -n 19

warm() { # warm <file> — read into page cache
    [ -f "$1" ] && $IONICE cat "$1" > /dev/null 2>&1 &
}

# Desktop shell + window manager + their plasmoids/effects
for bin in /usr/bin/plasmashell /usr/bin/kwin_wayland /usr/bin/kwin_x11 \
           /usr/bin/krunner /usr/bin/plasmashell /usr/bin/ksmserver \
           /usr/bin/kded6 /usr/bin/systemsettings /usr/bin/dolphin \
           /usr/bin/konsole /usr/bin/kate /usr/bin/spectacle /usr/bin/gwenview \
           /usr/bin/xdg-desktop-portal-kde; do
    warm "$bin"
done

# pearOS apps (dock launch targets)
for bin in /usr/bin/pearos-* /usr/bin/pear-* /usr/bin/seafari /usr/bin/*appstore*; do
    warm "$bin" 2>/dev/null
done

# The big shared libraries every KDE app maps (Qt6/KDE Frameworks) — this is
# where most of the first-launch cost actually lives.
$IONICE bash -c 'cat /usr/lib/libQt6*.so* /usr/lib/libKF6*.so* \
    /usr/lib/libplasma*.so* /usr/lib/libkwin*.so* > /dev/null 2>&1' &

# Fonts + icon theme indexes (first-draw latency)
$IONICE bash -c 'cat /usr/share/icons/*/icon-theme.cache /usr/lib/systemd/system/* > /dev/null 2>&1' &

wait
exit 0
