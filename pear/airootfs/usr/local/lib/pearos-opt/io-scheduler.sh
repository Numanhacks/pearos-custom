#!/usr/bin/env bash
# io-scheduler.sh — per-drive-type storage tuning. Surface Laptop 4: NVMe.
set -Eeuo pipefail
log() { echo "[io] $*"; }

tune_disk() {
    local dev=$1 base="/sys/block/$dev/queue"
    local rotational sched
    rotational=$(cat "$base/rotational" 2>/dev/null || echo 1)

    # what schedulers does this disk support?
    scheds=$(cat "$base/scheduler" 2>/dev/null || echo "")

    if [[ $dev == nvme* && $dev != *nvme* ]]; then :; fi

    if [[ $dev == nvme[0-9]*n[0-9]* ]]; then
        # NVMe: none + deep queue
        echo none > "$base/scheduler" 2>/dev/null || \
            echo "$scheds" | grep -o 'none' | head -1 > "$base/scheduler" 2>/dev/null || true
        echo 2048 > "$base/nr_requests" 2>/dev/null || true
        echo 2 > "$base/nomerges" 2>/dev/null || true
        echo 4096 > "$base/read_ahead_kb" 2>/dev/null || true
        echo 0 > "$base/rotational" 2>/dev/null || true
        log "$dev: NVMe -> scheduler=none nr_requests=2048 nomerges=2"
    elif [[ $rotational == 0 ]]; then
        echo mq-deadline > "$base/scheduler" 2>/dev/null || true
        echo 2048 > "$base/nr_requests" 2>/dev/null || true
        echo 1024 > "$base/read_ahead_kb" 2>/dev/null || true
        log "$dev: SATA SSD -> mq-deadline"
    else
        echo bfq > "$base/scheduler" 2>/dev/null || true
        echo 256 > "$base/read_ahead_kb" 2>/dev/null || true
        echo 512 > "$base/iosched/slice_idle" 2>/dev/null || true
        log "$dev: HDD -> bfq"
    fi
}

for d in /sys/block/*; do
    dev=$(basename "$d")
    [[ $dev == loop* || $dev == ram* || $dev == zram* || $dev == dm-* ]] && continue
    tune_disk "$dev"
done

# noatime: fix up fstab (idempotent)
if ! grep -q 'noatime' /etc/fstab; then
    sed -i -E 's/(\s+(ext4|xfs|btrfs|vfat|ntfs3)\s+defaults)\s/\1,noatime /' /etc/fstab 2>/dev/null \
      || sed -i -E 's/\s(defaults)\s/\1,noatime /' /etc/fstab 2>/dev/null || true
    log "fstab: noatime added (full effect after reboot / remount)"
fi
log "done"
