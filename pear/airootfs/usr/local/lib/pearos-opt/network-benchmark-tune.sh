#!/usr/bin/env bash
# network-benchmark-tune.sh — network/crypto stack optimization.
set -Eeuo pipefail
log() { echo "[net] $*"; }

cat > /etc/sysctl.d/72-network-performance.conf <<'EOF'
# big socket buffers (BCB 128MB ceiling; autotuning uses what it needs)
net.core.rmem_max = 134217728
net.core.wmem_max = 134217728
net.ipv4.tcp_rmem = 4096 87380 134217728
net.ipv4.tcp_wmem = 4096 65536 134217728
net.core.netdev_max_backlog = 65536
net.core.somaxconn = 65535
# BBR congestion control + fq qdisc
net.core.default_qdisc = fq
net.ipv4.tcp_congestion_control = bbr
net.ipv4.tcp_slow_start_after_idle = 0
net.ipv4.ip_local_port_range = 1024 65535
net.ipv4.tcp_fastopen = 3
net.ipv4.tcp_mtu_probing = 1
EOF
sysctl --system >/dev/null 2>&1 || true

# BBR availability check
CC=$(sysctl -n net.ipv4.tcp_congestion_control 2>/dev/null || echo unknown)
[[ $CC == bbr ]] && log "BBR active" || { modprobe tcp_bbr 2>/dev/null || true; log "WARNING: bbr not active (current: $CC) — kernel module tcp_bbr required"; }

# crypto: ensure AES-NI path (AMD 4980U has AES) is used
grep -q aes /proc/crypto && log "AES-NI: active in kernel crypto" || log "AES acceleration not visible"

log "done"
