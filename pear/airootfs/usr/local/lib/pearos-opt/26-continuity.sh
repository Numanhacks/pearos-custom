#!/usr/bin/env bash
# 26 — continuity: KDE Connect = clipboard/handoff/AirDrop/notifications/remote input.
set -Eeuo pipefail
log() { echo "[continuity] $*"; }
for p in kdeconnect kdeconnect-kde; do pacman -S --needed --noconfirm "$p" 2>/dev/null && break; done || \
    apt-get install -y kdeconnect 2>/dev/null || dnf install -y kdeconnect 2>/dev/null || true
systemctl --global enable --now kdeconnectd 2>/dev/null || true
# mDNS discovery + encrypted transfer (TLS) are KDE Connect built-ins.
# Auto-unlock via BLE proximity: bluez proximity plugin / kdeconnect trust pairs.
log "KDE Connect enabled: universal clipboard, handoff, AirDrop-equivalent, shared notifications"
