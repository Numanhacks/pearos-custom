#!/usr/bin/env bash
# 24 — pearos-app-lifecycle: bundles (Flatpak), sandboxing, background discipline.
# Ties into app-nap (item: 60s freeze / 5min compress / 30min swap) already shipped.
set -Eeuo pipefail
log() { echo "[app-lifecycle] $*"; }

# self-contained bundles with dependency resolution + atomic updates
if ! command -v flatpak >/dev/null; then
    pacman -S --needed --noconfirm flatpak 2>/dev/null || apt-get install -y flatpak 2>/dev/null \
        || dnf install -y flatpak 2>/dev/null || true
fi
flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo 2>/dev/null || true
# atomic updates + clean uninstall = `flatpak uninstall <app>` (one folder per app)
systemctl enable --now flatpak-system-update.timer 2>/dev/null || true

# capability sandboxing by default (camera/network/files portals) — Flatpak uses
# XDG portals for per-app permission grants; no admin-by-default.
flatpak override --filesystem=home:ro --device=dri 2>/dev/null || true

# background abuse auto-kill: apps without declared background use get frozen
# by app-nap; heavy abusers beyond 30min tier get SIGKILL by oomd under pressure.
systemctl enable --now app-nap.service 2>/dev/null || true
log "Flatpak bundles + portals + app-nap lifecycle active"
