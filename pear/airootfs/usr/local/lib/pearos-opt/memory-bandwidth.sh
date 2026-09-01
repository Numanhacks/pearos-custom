#!/usr/bin/env bash
# memory-bandwidth.sh — maximize memory throughput (4980U: dual-channel DDR4).
set -Eeuo pipefail
log() { echo "[membw] $*"; }

# THP madvise (aligns with 99-macos-memory.conf)
echo madvise > /sys/kernel/mm/transparent_hugepage/enabled 2>/dev/null || true

# NUMA interleave=all wrapper
if ! command -v numactl >/dev/null; then
    pacman -S --needed --noconfirm numactl 2>/dev/null || apt-get install -y numactl 2>/dev/null \
        || dnf install -y numactl 2>/dev/null || log "WARN: install numactl"
fi
cat > /usr/local/bin/pear-numactl <<'EOF'
#!/usr/bin/env bash
# Run any command with full memory interleave + hugepage preference:
#   pear-numactl geekbench6
exec numactl --interleave=all "$@"
EOF
chmod +x /usr/local/bin/pear-numactl

# hugepage pool via hugetlbfs (THP-adjacent, MAP_HUGETLB consumers)
HP_AVAIL=$(awk '/Hugepagesize/{print $2}' /proc/meminfo)     # KiB per page (2048)
WANT_MB=256
PAGES=$(( WANT_MB * 1024 / (HP_AVAIL > 0 ? HP_AVAIL : 2048) ))
echo "$PAGES" > /proc/sys/vm/nr_hugepages 2>/dev/null && log "$PAGES hugepages (${HP_AVAIL}KiB each) reserved" \
    || log "hugepage reserve failed (fragmented) — THP=madvise still active"

# compaction: off during benchmarks (it stalls allocations), light otherwise
sysctl -q -w vm.compaction_proactiveness=0 2>/dev/null || true

# zone reclaim off (already in sysctl file; enforce)
sysctl -q -w vm.zone_reclaim_mode=0 >/dev/null

cat > /etc/sysctl.d/71-memory-bandwidth.conf <<'EOF'
vm.compaction_proactiveness = 0
vm.hugetlb_shm_group = 0
vm.max_map_count = 1048576
EOF
sysctl --system >/dev/null 2>&1 || true
log "done — wrap benchmarks with: pear-numactl <command>"
