#!/usr/bin/env bash
# thermal-manager.sh — prevent premature throttling on thin laptops (Surface Laptop 4).
# Policy: log & monitor, never force-lower freq; HARD SAFETY: 95C for 10s -> backoff.
set -Eeuo pipefail

log() { logger -t thermal-mgr "$*"; echo "[thermal] $*"; }
HOT_LIMIT=95000     # millidegrees
HOT_SECS=10

# ---- runtime knobs ----
# thermal polling 1s (default 4s)
[[ -w /sys/class/thermal/thermal_zone0/mode ]] && echo enabled > /sys/class/thermal/thermal_zone0/mode 2>/dev/null || true
sysctl -q -w kernel.hung_task_timeout_secs=0 >/dev/null 2>&1 || true
# software throttling governors off (ARM/x86 both): intel_pstate keep turbo
echo 0 > /sys/devices/system/cpu/intel_pstate/no_turbo 2>/dev/null || true
echo 1 > /sys/devices/system/cpu/cpufreq/boost 2>/dev/null || true
for p in /sys/devices/system/cpu/cpufreq/policy*; do
    grep -qw performance "$p/scaling_available_governors" 2>/dev/null && echo performance > "$p/scaling_governor" 2>/dev/null || true
done

# x86 MSR power/prochot — only with safety checks (temp sane, msr module present)
ARCH=$(uname -m)
if [[ $ARCH == x86_64 ]] && command -v rdmsr >/dev/null 2>&1; then
    modprobe msr 2>/dev/null || true
    if [[ -w /dev/cpu/0/msr ]]; then
        t0=$(awk '{print $1}' /sys/class/thermal/thermal_zone0/temp 2>/dev/null || echo 0)
        if (( t0 < 80000 )); then
            wrmsr -a 0x1FC 0x0 2>/dev/null && log "BD_PROCHOT cleared" || log "MSR 0x1FC locked by firmware — skipped"
        else
            log "temp high ($((t0/1000))C) — not touching MSRs"
        fi
    fi
fi

# ---- monitor loop (systemd service runs this) ----
HOT_SINCE=0
BACKED_OFF=0
while true; do
    HOT_NOW=0
    for z in /sys/class/thermal/thermal_zone*; do
        t=$(cat "$z/temp" 2>/dev/null) || continue
        (( t >= HOT_LIMIT )) && { HOT_NOW=1; log "zone ${z##*/} at $((t/1000))C"; }
    done
    now=$(date +%s)
    if (( HOT_NOW )); then
        (( HOT_SINCE == 0 )) && HOT_SINCE=$now
        if (( now - HOT_SINCE >= HOT_SECS && BACKED_OFF == 0 )); then
            log "SAFETY BACKOFF: >=95C for ${HOT_SECS}s — forcing balanced governor"
            for p in /sys/devices/system/cpu/cpufreq/policy*; do
                grep -qw schedutil "$p/scaling_available_governors" 2>/dev/null && \
                    echo schedutil > "$p/scaling_governor" 2>/dev/null || true
                cat "$p/cpuinfo_min_freq" > "$p/scaling_min_freq" 2>/dev/null || true
            done
            BACKED_OFF=1
        fi
    else
        HOT_SINCE=0
        # cool again (2C hysteresis below the limit): restore the performance governor
        if (( BACKED_OFF )); then
            HOTTEST=0
            for z in /sys/class/thermal/thermal_zone*; do
                t=$(cat "$z/temp" 2>/dev/null) || continue
                (( t > HOTTEST )) && HOTTEST=$t
            done
            if (( HOTTEST > 0 && HOTTEST < HOT_LIMIT - 2000 )); then
                log "cooled to $((HOTTEST/1000))C — restoring performance governor"
                for p in /sys/devices/system/cpu/cpufreq/policy*; do
                    grep -qw performance "$p/scaling_available_governors" 2>/dev/null && \
                        echo performance > "$p/scaling_governor" 2>/dev/null || true
                done
                BACKED_OFF=0
            fi
        fi
    fi
    sleep 1
done
