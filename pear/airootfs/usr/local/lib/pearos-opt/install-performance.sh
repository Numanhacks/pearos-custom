#!/usr/bin/env bash
# install-performance.sh — install the performance suite + wire into systemd.
# Integrates with the memory optimizer (items 1-9): sysctl files numbered 70+,
# service ordered After zram-setup.service.
set -Eeuo pipefail
[[ $EUID -eq 0 ]] || { echo "run as root"; exit 1; }
SD="$(cd "$(dirname "$0")" && pwd)"
log() { echo "[install] $*"; }

install -Dm755 "$SD/cpu-performance.sh"         /usr/local/sbin/cpu-performance.sh
install -Dm755 "$SD/irq-balance.sh"             /usr/local/sbin/irq-balance.sh
install -Dm755 "$SD/geekbench-mode.sh"          /usr/local/bin/geekbench-mode.sh
install -Dm755 "$SD/thermal-manager.sh"         /usr/local/sbin/thermal-manager.sh
install -Dm755 "$SD/gpu-compute-optimize.sh"    /usr/local/sbin/gpu-compute-optimize.sh
install -Dm755 "$SD/io-scheduler.sh"            /usr/local/sbin/io-scheduler.sh
install -Dm755 "$SD/memory-bandwidth.sh"        /usr/local/sbin/memory-bandwidth.sh
install -Dm755 "$SD/network-benchmark-tune.sh"  /usr/local/sbin/network-benchmark-tune.sh
install -Dm755 "$SD/pear-perf-restore.sh"       /usr/local/bin/pear-perf-restore
install -Dm644 "$SD/kernel-params-performance.conf" /usr/local/share/pear-kernel-params-performance.conf
install -Dm644 "$SD/pearos-performance-meta.service" /etc/systemd/system/pearos-performance-meta.service

bash "$SD/cpu-performance.sh"
bash "$SD/io-scheduler.sh"
bash "$SD/memory-bandwidth.sh"
bash "$SD/network-benchmark-tune.sh"
bash "$SD/gpu-compute-optimize.sh"
bash "$SD/irq-balance.sh"

systemctl daemon-reload
systemctl enable --now pearos-performance-meta.service
log "installed. meta service: systemctl status pearos-performance-meta"
log "benchmark:  sudo geekbench-mode.sh <command>   |  --persistent"
log "revert anytime: systemctl stop pearos-performance-meta (runs pear-perf-restore)"
