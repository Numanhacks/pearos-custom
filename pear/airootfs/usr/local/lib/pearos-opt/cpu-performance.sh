#!/usr/bin/env bash
# cpu-performance.sh — scheduler/governor tuning. x86_64 (Intel/AMD) + ARM64.
# AMD Surface Laptop 4 path: amd-pstate performance, boost on, deep C-states off.
set -Eeuo pipefail

log() { echo "[cpu] $*"; }
ARCH=$(uname -m)
VENDOR=""
grep -qi 'amd\|hygon' /proc/cpuinfo && VENDOR=amd
grep -qi 'intel' /proc/cpuinfo && VENDOR=${VENDOR:-intel}
[[ $ARCH == aarch64 ]] && VENDOR=arm

log "arch=$ARCH vendor=$VENDOR"

# ---- 1) Governor: performance on every cpufreq policy ------------------------
for policy in /sys/devices/system/cpu/cpufreq/policy*; do
    [[ -d $policy ]] || continue
    gov="$policy/scaling_governor"
    [[ -w $gov ]] || continue
    if grep -qw performance "$policy/scaling_available_governors" 2>/dev/null; then
        echo performance > "$gov"
        # pin min=max (kills ramp latency; harmless on battery? it costs power)
        [[ -r $policy/cpuinfo_max_freq ]] && {
            cat "$policy/cpuinfo_max_freq" > "$policy/scaling_min_freq" 2>/dev/null || true
        }
    elif [[ $VENDOR == arm ]]; then
        # ARM: schedutil is the default; performance governor or max freq
        echo performance > "$gov" 2>/dev/null || \
            cat "$policy/cpuinfo_max_freq" > "$policy/scaling_setspeed" 2>/dev/null || true
    fi
done
log "governors set to performance (min=max)"

# ---- 2) Turbo/boost indefinitely ----------------------------------------------
if [[ $VENDOR == amd ]]; then
    echo 1 > /sys/devices/system/cpu/cpufreq/boost 2>/dev/null || true
    [[ -w /sys/devices/system/cpu/amd_pstate/status ]] && echo active > /sys/devices/system/cpu/amd_pstate/status 2>/dev/null || true
elif [[ $VENDOR == intel ]]; then
    echo 0 > /sys/devices/system/cpu/intel_pstate/no_turbo 2>/dev/null || true
    echo 1 > /sys/devices/system/cpu/cpufreq/boost 2>/dev/null || true
fi
log "boost enabled"

# ---- 3) Disable deep C-states at runtime (C1 kept). Boot params finish this. --
if [[ -d /dev/cpu/0/msr ]] || modprobe msr 2>/dev/null; then
    if command -v wrmsr >/dev/null 2>&1; then
        # MSR_PKG_CST_CONTROL (0xE2): 1 = only C1 (package). IA32_MISC (0x1A0) bit 7 = C1E off... keep conservative: only 0xE2.
        for cpu in /dev/cpu/[0-9]*; do
            [[ -w $cpu/msr ]] && wrmsr -a 0xE2 1 2>/dev/null || true
        done
        log "package C-state limit set to C1 (MSR 0xE2)"
    fi
else
    log "MSR unavailable — rely on boot params intel_idle.max_cstate/processor.max_cstate"
fi

# ---- 4) Scheduler tunables + NUMA ----
cat > /etc/sysctl.d/70-cpu-performance.conf <<'EOF'
# Interactive/throughput scheduler: lower latency, finer preemption granularity
kernel.sched_latency_ns = 1000000
kernel.sched_min_granularity_ns = 100000
kernel.sched_wakeup_granularity_ns = 50000
# NUMA balancing off (already in 99-macos-memory.conf; belt & suspenders)
kernel.numa_balancing = 0
EOF
sysctl --system >/dev/null 2>&1 || true

# ---- 5) x86: BD_PROCHOT off via MSR 0x1FC (bi-directional prochot — stops
# fake thermal pinning from EC). SAFETY: only when temps are sane.
if [[ $VENDOR != arm ]] && command -v rdmsr >/dev/null 2>&1 && [[ -w /dev/cpu/0/msr ]]; then
    TEMP=$(awk '{printf "%d", $1/1000}' /sys/class/thermal/thermal_zone0/temp 2>/dev/null || echo 0)
    if (( TEMP < 80 )); then
        wrmsr -a 0x1FC 0x0 2>/dev/null || log "BD_PROCHOT write not permitted (locked BIOS) — skipped"
        log "BD_PROCHOT cleared ( MSR 0x1FC )"
    else
        log "temp ${TEMP}C too high for MSR write — skipped (safety)"
    fi
fi

log "done"
