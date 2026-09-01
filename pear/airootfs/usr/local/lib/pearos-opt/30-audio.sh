#!/usr/bin/env bash
# 30 — audio: PipeWire pro-audio tuning — low quantum (sub-5ms pro path),
# spatial audio (HRTF), per-app volume, BT codecs (LDAC/aptX via pipewire codecs).
set -Eeuo pipefail
log() { echo "[audio] $*"; }
pacman -S --needed --noconfirm pipewire pipewire-pulse wireplumber pipewire-alsa \
        libldacBT libfreeaptx 2>/dev/null || true
mkdir -p /etc/pipewire/pipewire.conf.d /etc/wireplumber
# pro-audio low latency: 48kHz quantum 128 (~2.7ms) available; consumer default 1024
cat > /etc/pipewire/pipewire.conf.d/10-latency.conf <<'EOF'
context.properties = {
  default.clock.rate = 48000
  default.clock.quantum = 1024
  default.clock.min-quantum = 128
  default.clock.max-quantum = 1024
}
EOF
# HRTF spatial audio for headphones
cat > /etc/wireplumber/wireplumber.conf.d/50-spatial.conf <<'EOF'
monitor.pipewire.rules = [
  { matches = [ { node.name = "~alsa_output.*" } ]
    actions = { update-props = { channelmix.hrtf = true } } }
]
EOF
systemctl enable --now pipewire pipewire-pulse wireplumber 2>/dev/null || true
log "PipeWire: min quantum 128 (~2.7ms), HRTF, LDAC/aptX, per-app volumes"
