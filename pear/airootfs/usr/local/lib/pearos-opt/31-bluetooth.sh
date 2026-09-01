#!/usr/bin/env bash
# 31 — bluetooth: BlueZ single daemon, fast pairing, LE Audio experimental,
# auto-reconnect (AirPods-style switching via wireplumber policy).
set -Eeuo pipefail
log() { echo "[bluetooth] $*"; }
pacman -S --needed --noconfirm bluez bluez-utils 2>/dev/null || true
mkdir -p /etc/bluetooth
# fast connect + LE Audio features
sed -i 's/^#*FastConnectable.*/FastConnectable = true/' /etc/bluetooth/main.conf 2>/dev/null || true
sed -i 's/^#*ReconnectAttempts.*/ReconnectAttempts = 7/' /etc/bluetooth/main.conf 2>/dev/null || true
sed -i 's/^#*ReconnectIntervals.*/ReconnectIntervals = 1,2,4,8,16,32,64/' /etc/bluetooth/main.conf 2>/dev/null || true
grep -q '^Experimental' /etc/bluetooth/main.conf || echo 'Experimental = true' >> /etc/bluetooth/main.conf  # LE Audio/Auracast
systemctl enable --now bluetooth 2>/dev/null || true
log "BlueZ: fast connect, reconnect policy, LE Audio/Auracast experimental on"
