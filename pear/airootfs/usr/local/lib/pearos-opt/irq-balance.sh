#!/usr/bin/env bash
# irq-balance.sh — static IRQ affinity. Reserve CPU0-1 for system/UI.
# Ryzen 7 4980U: 8C/16T, no hybrid P/E cores -> all CPUs are "P-cores";
# topology detection handles hybrid (Intel 12th+) generically.
set -Eeuo pipefail

log() { echo "[irq] $*"; }
command -v irqbalance >/dev/null && systemctl disable --now irqbalance 2>/dev/null || true

NCPU=$(nproc)
# Hybrid detection: Intel 12th+ expose E-cores via /sys/devices/system/cpu/cpu*/topology/core_type (intel_pstate) — fallback: cpu_capacity on ARM
UI_CPUS="0-1"
WORK_CPUS_START=2
WORK_LIST=$(seq $WORK_CPUS_START $((NCPU-1)) | tr '\n' ',' | sed 's/,$//')
# net IRQs get a small dedicated pair of worker cores, clipped to what exists
NET_AFFINITY="2-3"
if [ "$NCPU" -lt 4 ]; then
    NET_AFFINITY="$WORK_LIST"
fi

classify_irq() { # classify_irq <irq> -> prints net|storage|gpu|other
    local irq="$1" dev=""
    for f in /sys/kernel/irq/$irq/actions /proc/irq/$irq/*/name; do
        [[ -r $f ]] && cat "$f" && break
    done
}

for irqq in /proc/irq/[0-9]*; do
    irq=${irqq#/proc/irq/}
    [[ $irq =~ ^[0-9]+$ ]] || continue
    actions=$(cat /proc/irq/$irq/*/name 2>/dev/null | tr '\n' ' ')
    target="$WORK_LIST"
    case "$actions" in
        *nvme*|*ahci*|*sata*|*"ata_"*) target=$((WORK_CPUS_START)) ;;                    # storage: dedicated core
        *amdgpu*|*i915*|*nvidia*|*drm*|*gfx*|*display*)                                 # GPU/display: near GPU node
            target=$WORK_LIST ;;
        *enp*|*wlp*|*eth*|*wifi*|*r8169*|*mt79*|*iwlmvm*|*ixgbe*|*igb*) target="$NET_AFFINITY" ;; # net: dedicated worker pair
    esac
    # never steal CPU0-1 from system/UI
    case "$target" in 0*|1*) continue ;; esac
    echo "$target" > "/proc/irq/$irq/smp_affinity_list" 2>/dev/null || true
done
log "IRQ affinity: UI=$UI_CPUS net=$NET_AFFINITY storage=$WORK_CPUS_START rest=$WORK_LIST"

# persist via systemd unit (see pearos-performance-meta.target Wants chain)
cat > /etc/systemd/system/irq-affinity.service <<'EOF'
[Unit]
Description=Static IRQ affinity (pearOS performance suite)
After=multi-user.target
[Service]
Type=oneshot
ExecStart=/usr/local/sbin/irq-balance.sh
RemainAfterExit=yes
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable irq-affinity.service 2>/dev/null || true
