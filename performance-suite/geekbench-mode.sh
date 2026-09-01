#!/usr/bin/env bash
# geekbench-mode.sh — one-click benchmark/game mode with full auto-restore.
# Usage: sudo ./geekbench-mode.sh <command...>        e.g. ./geekbench-mode.sh geekbench6
#        sudo ./geekbench-mode.sh --persistent        keep until reboot (no command)
set -Eeuo pipefail

log() { echo "[bench] $*"; }
STATE=/run/geekbench-mode
PERSISTENT=0
CMD=""
if [[ ${1:-} == "--persistent" ]]; then PERSISTENT=1; shift; fi
CMD="${*:-}"

# ---- snapshot (restore-on-exit) ----
mkdir -p "$STATE"
cp /proc/irq/*/smp_affinity_list "$STATE/" 2>/dev/null || true
sysctl -a 2>/dev/null | grep -E 'kernel\.(sched_latency_ns|sched_min_granularity|sched_wakeup|watchdog|nmi_watchdog)|vm\.compaction_proactiveness' > "$STATE/sysctl.txt" || true

restore() {
    log "restoring..."
    systemctl start app-nap.service 2>/dev/null || true
    systemctl start cups bluetooth avahi-daemon cron 2>/dev/null || true
    sysctl vm.compaction_proactiveness=20 >/dev/null
    echo 3 > /proc/sys/kernel/watchdog 2>/dev/null || true
    # governors back
    for policy in /sys/devices/system/cpu/cpufreq/policy*; do
        grep -qw schedutil "$policy/scaling_available_governors" 2>/dev/null && echo schedutil > "$policy/scaling_governor" 2>/dev/null
        cat "$policy/cpuinfo_min_freq" > "$policy/scaling_min_freq" 2>/dev/null || true
    done
    # cgroups thaw
    for c in /sys/fs/cgroup/app-nap.slice/tier*; do echo 0 > "$c/cgroup.freeze" 2>/dev/null || true; done
    log "restored. (IRQ affinity restored on reboot; run restore-irq manually if needed)"
}
[[ $PERSISTENT -eq 0 ]] && trap restore EXIT

# ---- apply bench mode ----
systemctl stop app-nap.service 2>/dev/null || true
systemctl stop cups bluetooth avahi-daemon cron 2>/dev/null || true

sysctl -q -w kernel.watchdog=0 vm.compaction_proactiveness=0 2>/dev/null || true
echo 0 > /proc/sys/kernel/nmi_watchdog 2>/dev/null || true
sysctl -q -w kernel.sched_boost=1 2>/dev/null || log "kernel.sched_boost not available (kernel <6.9?) — skipped"

sync
echo 3 > /proc/sys/vm/drop_caches
echo 1 > /proc/sys/vm/compaction_proactiveness 2>/dev/null || true

# governors: performance + min=max (reuse cpu-performance.sh logic)
for policy in /sys/devices/system/cpu/cpufreq/policy*; do
    grep -qw performance "$policy/scaling_available_governors" 2>/dev/null && echo performance > "$policy/scaling_governor"
    cat "$policy/cpuinfo_max_freq" > "$policy/scaling_min_freq" 2>/dev/null || true
done

# freeze non-essential cgroups (user bg apps), never system.slice
for c in /sys/fs/cgroup/user.slice/user-*.slice/user@*.service/app.slice; do
    [[ -w $c/cgroup.freeze ]] && echo 1 > "$c/cgroup.freeze" 2>/dev/null || true
done

# thermal monitor during run: log throttle events
( while [[ -d /proc/$PPID ]]; do
    for z in /sys/class/thermal/thermal_zone*; do
        t=$(cat "$z/temp" 2>/dev/null) || continue
        (( t > 95000 )) && logger -t bench-thermal "THROTTLE-RISK ${z}: $((t/1000))C"
    done
    sleep 1
  done ) & TMOD=$!

if [[ -n "$CMD" ]]; then
    # pin to cores 2-N (keep CPU0-1 for system), SCHED_FIFO 99
    NCPU=$(nproc)
    CPULIST=$(seq 2 $((NCPU-1)) | tr '\n' ',' | sed 's/,$//')
    log "running pinned: taskset -c $CPULIST chrt -f 99 $CMD"
    taskset -c "$CPULIST" chrt -f 99 "$CMD"
    kill $TMOD 2>/dev/null || true
else
    log "benchmark mode ON (persistent until reboot or Ctrl-C)."
    if [[ $PERSISTENT -eq 0 ]]; then
        read -rp "Press Enter to restore... "
    else
        sleep infinity & wait $! || true
    fi
fi
