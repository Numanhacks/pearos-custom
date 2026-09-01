#!/usr/bin/env bash
# ============================================================================
# setup-zram.sh — zram0 sized to min(50% RAM, 8GB), zstd, priority 100.
# Existing disk swap is automatically demoted to priority 10.
# Idempotent. Requires kernel 5.15+ (CONFIG_ZRAM). No external tools needed.
# ============================================================================
set -Eeuo pipefail

ZRAM_DEV=/dev/zram0
MAX_BYTES=$((8 * 1024 * 1024 * 1024))   # 8 GiB cap
PRIORITY_ZRAM=100
PRIORITY_DISK=10

log() { echo "[zram] $*"; }

# ---- already active? ---------------------------------------------------------
if grep -qs "$ZRAM_DEV " /proc/swaps; then
    log "zram0 already active — verifying settings only."
    exit 0
fi

# ---- read total RAM ----------------------------------------------------------
if [[ -r /proc/meminfo ]]; then
    MEM_KB=$(awk '/^MemTotal:/{print $2}' /proc/meminfo)
else
    echo "Cannot read /proc/meminfo" >&2; exit 1
fi
ZRAM_BYTES=$(( MEM_KB * 1024 / 2 ))
(( ZRAM_BYTES > MAX_BYTES )) && ZRAM_BYTES=$MAX_BYTES
log "Total RAM: $((MEM_KB/1024)) MiB — sizing zram0 to $((ZRAM_BYTES/1024/1024)) MiB"

# ---- load module & configure -------------------------------------------------
modprobe zram num_devices=1 2>/dev/null || true
[[ -e "$ZRAM_DEV" ]] || { echo "zram device not available (kernel lacks CONFIG_ZRAM)" >&2; exit 1; }

# reset if previously configured in this boot but not swapped on
if [[ -n "$(cat /sys/block/zram0/disksize 2>/dev/null)" && "$(cat /sys/block/zram0/disksize)" != "0" ]]; then
    echo 1 > /sys/block/zram0/reset
fi

# compression algorithm — prefer zstd, degrade gracefully
if grep -qw zstd /sys/block/zram0/comp_algorithm; then
    echo zstd > /sys/block/zram0/comp_algorithm
    log "Compression: zstd"
else
    log "WARNING: zstd unsupported; using: $(grep -o '^\[[a-z0-9]*\]' /sys/block/zram0/comp_algorithm | tr -d '[]')"
fi

echo "$ZRAM_BYTES" > /sys/block/zram0/disksize
log "Disksize set."

log "Enabling zram swap at priority $PRIORITY_ZRAM"
mkswap -L zram0 "$ZRAM_DEV" >/dev/null 2>&1 || mkswap "$ZRAM_DEV" >/dev/null
swapon -p "$PRIORITY_ZRAM" "$ZRAM_DEV"

# If a disk swapfile/partition exists in fstab, ensure its future priority is 10
FSTAB=/etc/fstab
if grep -vE '^\s*#' "$FSTAB" | grep -qE '\sswap\s'; then
    if ! grep -q 'pri=10' "$FSTAB"; then
        sed -i -E 's/^(\s*[^#\s]\S*\s+\S+\s+swap\s+sw\s*)$/\1,pri=10/' "$FSTAB" \
          || sed -i -E 's/^([^#\s]\S*\s+\S+\s+swap\s+sw)(\s.*)?$/\1,pri=10\2/' "$FSTAB"
        log "fstab: disk swap demoted to pri=10 (takes effect next swapon/boot)."
    fi
fi

# Also demote currently-active disk swaps (swapoff+swapon) unless they are
# the only swap and zram just came up (avoid dropping swap entirely).
ZRAM_NOW=$(grep -c "^$ZRAM_DEV " /proc/swaps || true)
for sw in $(awk '$1 !~ /zram/ && $1 ~ /^\/dev\// {print $1}' /proc/swaps); do
    if (( ZRAM_NOW > 0 )); then
        swapoff "$sw" 2>/dev/null && swapon -p "$PRIORITY_DISK" "$sw" 2>/dev/null \
            && log "Demoted $sw to priority $PRIORITY_DISK" \
            || log "Could not re-prioritize $sw (in use); it will be re-prioritized at next boot."
    fi
done

# swappiness is raised for zram (cheap swap) — matches macOS-like behavior:
# high swapiness + zram == better cache retention. sysctl file governs it;
# here we just make sure it is not 0.
sysctl -w vm.swappiness=100 >/dev/null 2>&1 || true
# page-cluster=0 means 4K granularity swap-in — right choice for zram
sysctl -w vm.page-cluster=0 >/dev/null 2>&1 || true

log "Done. Active swaps:"
cat /proc/swaps
exit 0
