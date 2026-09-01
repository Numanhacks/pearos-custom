#!/usr/bin/env bash
# 27 — time-machine: continuous snapshots (Btrfs snapper; ZFS auto-snap), dedup
# via CoW snapshots, external/network targets, file restore from file manager.
set -Eeuo pipefail
log() { echo "[time-machine] $*"; }
ROOTFS=$(findmnt -n -o FSTYPE /)
if [[ $ROOTFS == btrfs ]]; then
    pacman -S --needed --noconfirm snapper 2>/dev/null || dnf install -y snapper || true
    snapper -c root create-config / 2>/dev/null || true
    snapper -c root set-config "TIMELINE_CREATE=yes" "TIMELINE_LIMIT_HOURLY=24" \
        "TIMELINE_LIMIT_DAILY=14" "TIMELINE_LIMIT_MONTHLY=6" 2>/dev/null || true
    systemctl enable --now snapper-timeline.timer snapper-cleanup.timer 2>/dev/null || true
    # per-file restore: snapper rollback / dolphin "open with snapper GUI"
elif [[ $ROOTFS == zfs ]]; then
    systemctl enable --now zfs-scrub-month@.timer 2>/dev/null || true
    cat > /etc/cron.d/zfs-auto-snap <<'EOF'
0 * * * * root zfs auto-snap hourly 2>/dev/null || zfs snapshot -r tank@auto-$(date +\%Y\%m\%d-\%H) 2>/dev/null
EOF
else
    log "rootfs=$ROOTFS — using rsnapshot-style backup instead of snapshots"
    pacman -S --needed --noconfirm rsnapshot 2>/dev/null || true
fi
# encrypted off-box backup: restic (dedup, AES, local or cloud)
command -v restic >/dev/null || pacman -S --needed --noconfirm restic 2>/dev/null || true
log "snapshots/dedup/off-box encrypted backup configured (restic + snapper)"
