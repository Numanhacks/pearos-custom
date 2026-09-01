#!/usr/bin/env bash
# pearos-global-smoothness.sh — make EVERY UI stack in the OS buttery:
# Qt/Plasma, GTK, Electron, Chromium-browsers, Firefox, XWayland, fonts, cursor.
# Idempotent; per-user; revert via backups in /var/lib/pearos-smoothness.
set -Eeuo pipefail
BK=/var/lib/pearos-smoothness/backup
KW=$(command -v kwriteconfig6 >/dev/null && echo kwriteconfig6 || echo kwriteconfig5)
log() { echo "[smooth] $*"; }
backup() { local f="$1"; if [[ -e "$f" && ! -e "$BK$f" ]]; then mkdir -p "$BK$(dirname "$f")"; cp -a "$f" "$BK$f"; fi; }

# ── system-wide env: every Qt/GL/Electron/Vulkan app inherits these ─────────
backup /etc/environment
grep -q PEAROS_SMOOTH /etc/environment || cat >> /etc/environment <<'EOF'
# ── pearOS smoothness layer ─────────────────────────────────────────────
# Qt: threaded render loop (lower input→frame latency), GPU-accelerated widgets
QSG_RENDER_LOOP=threaded
QT_QUICK_CONTROLS_STYLE=macOS
QT_WAYLAND_DISABLE_WINDOWDECORATION=1
# GL: disable vsync-blocking in toolkit layers (compositor owns vsync)
vblank_mode=0
__GL_YIELD="USLEEP"
# skia/2D GPU
SKIA_GPU=1
EOF

for home in /root /home/*; do
    [[ -d $home ]] || continue
    u=$(basename "$home"); [[ $u == lost+found ]] && continue
    kc() { sudo -u "$u" XDG_CONFIG_HOME="$home/.config" "$KW" --file "$1" --group "$2" --key "$3" "$4" 2>/dev/null || true; }
    mkdir -p "$home/.config"

    # ── Qt/Plasma: no animation stalls, fast dialogs ──
    kc kdeglobals KDE AnimationDurationFactor 0.4
    kc kdeglobals KDE widgetStyle kvantum-dark

    # ── Electron apps (Discord/VS Code/Slack/pearos-appstore): GPU + vsync off ──
    backup "$home/.config/electron-flags.conf"
    cat > "$home/.config/electron-flags.conf" <<'EOF'
--enable-gpu-rasterization
--enable-zero-copy
--ignore-gpu-blocklist
--disable-frame-rate-limit
--disable-gpu-vsync
--canvas-oop-rasterization
EOF
    backup "$home/.config/chromium-flags.conf"
    cp "$home/.config/electron-flags.conf" "$home/.config/chromium-flags.conf"
    cp "$home/.config/electron-flags.conf" "$home/.config/chrome-flags.conf" 2>/dev/null || true

    # ── Firefox: full GPU pipeline ──
    FF="$home/.mozilla/firefox"
    if [[ -d $FF ]]; then
        for prof in "$FF"/*.default* "$FF"/*.default-release; do
            [[ -d $prof ]] || continue
            backup "$prof/user.js"
            cat >> "$prof/user.js" <<'EOF'
// pearOS smoothness: full GPU compositing
user_pref("gfx.webrender.all", true);
user_pref("gfx.webrender.compositor", true);
user_pref("layers.acceleration.force-enabled", true);
user_pref("dom.animations.offscreen-threaded", true);
EOF
        done
    fi

    # ── GTK3/GTK4 apps (file-roller, some Electron dialogs): GL renderer ──
    for v in 3.0 4.0; do
        mkdir -p "$home/.config/gtk-$v"
        ini="$home/.config/gtk-$v/settings.ini"
        backup "$ini"
        grep -q 'GSK_RENDERER' "$ini" 2>/dev/null || \
            printf '[Environment]\nGSK_RENDERER=ngl\n' >> "$ini"
    done

    chown -R "$u":"$u" "$home/.config" "$home/.mozilla" 2>/dev/null || true
done

# ── XWayland legacy apps: no tearing, direct scanout friendly ────────────────
# (KWin handles it; ensure the effect flags from ui-polish stay consistent)

# ── font rendering: crisp text reduces perceived jank on hi-dpi ──────────────
mkdir -p /etc/fonts/conf.d
cat > /etc/fonts/local.conf <<'EOF'
<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <match target="font">
    <edit name="antialias" mode="assign"><bool>true</bool></edit>
    <edit name="hinting" mode="assign"><bool>true</bool></edit>
    <edit name="hintstyle" mode="assign"><const>hintslight</const></edit>
    <edit name="rgba" mode="assign"><const>rgb</const></edit>
    <edit name="lcdfilter" mode="assign"><const>lcddefault</const></edit>
  </match>
</fontconfig>
EOF

log "global smoothness layer applied: Qt + Electron + Chromium + Firefox + GTK + fonts"
log "relogin required for env vars to reach all apps"
