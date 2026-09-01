#!/usr/bin/env bash
# pear-perf-restore — conservative restore used by pearos-performance-meta.service stop
set -u
echo "[perf-restore] reverting to balanced..."
for p in /sys/devices/system/cpu/cpufreq/policy*; do
    grep -qw schedutil "$p/scaling_available_governors" 2>/dev/null && echo schedutil > "$p/scaling_governor" 2>/dev/null
    cat "$p/cpuinfo_min_freq" > "$p/scaling_min_freq" 2>/dev/null || true
done
echo 0 > /proc/sys/kernel/watchdog 2>/dev/null || true
sysctl -q -w vm.compaction_proactiveness=20 kernel.sched_latency_ns=24000000 \
        kernel.sched_min_granularity_ns=3000000 kernel.sched_wakeup_granularity_ns=4000000 2>/dev/null || true
echo "[perf-restore] done"
