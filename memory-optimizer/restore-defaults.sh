#!/usr/bin/env bash
# ============================================================================
# restore-defaults.sh — Revert every change made by optimize-memory.sh.
# Run as root:  sudo ./restore-defaults.sh
# ============================================================================
set -Euo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "$(readlink -f -- "$0")")" && pwd)"
BACKUP_DIR="/var/lib/optimize-memory/backup"
log()  { echo "[restore] $*"; }

# ---- 1) Stop services -------------------------------------------------------
log "Stopping and disabling services..."
for svc in app-nap.service ksm.timer ksm.service systemd-oomd.service; do
    systemctl disable --now "$svc" 2>/dev/null || true
done
systemctl daemon-reload

# ---- 2) Unfreeze anything still napped & remove nap cgroups -----------------
log "Unfreezing napped apps and removing cgroups..."
if [[ -d /sys/fs/cgroup/app-nap.slice ]]; then
    for t in tier1 tier2 tier3; do
        [[ -f /sys/fs/cgroup/app-nap.slice/$t/cgroup.freeze ]] && \
            echo 0 > /sys/fs/cgroup/app-nap.slice/$t/cgroup.freeze 2>/dev/null
        # move everything back to root
        while read -r pid; do echo "$pid" > /sys/fs/cgroup/cgroup.procs 2>/dev/null || break; done \
            < /sys/fs/cgroup/app-nap.slice/$t/cgroup.procs 2>/dev/null
        rmdir "/sys/fs/cgroup/app-nap.slice/$t" 2>/dev/null || true
    done
    rmdir /sys/fs/cgroup/app-nap.slice 2>/dev/null || true
fi

# ---- 3) Remove config files --------------------------------------------------
log "Removing configs..."
rm -f /etc/sysctl.d/99-macos-memory.conf
rm -f /etc/systemd/oomd.conf.d/50-macos-memory.conf
rm -f /etc/systemd/system/system.slice.d/50-oomd.conf
rm -f /etc/systemd/system/user.slice.d/50-oomd.conf
rm -f /etc/systemd/system/user@.service.d/50-oomd.conf
rm -f /etc/systemd/system/app-nap.service
rm -f /etc/systemd/system/ksm.service /etc/systemd/system/ksm.timer
rm -f /usr/local/lib/app-nap/app-nap-daemon.py
rm -f /usr/local/sbin/ksm-activate.sh /usr/local/sbin/setup-zram.sh

# ---- 4) zram teardown ---------------------------------------------------------
log "Tearing down zram..."
if grep -qs '^/dev/zram0 ' /proc/swaps; then
    swapoff /dev/zram0 2>/dev/null || true
    echo 1 > /sys/block/zram0/reset 2>/dev/null || true
fi
rm -f /etc/systemd/zram-generator.conf

# ---- 5) Restore backed-up files ------------------------------------------------
if [[ -d $BACKUP_DIR ]]; then
    log "Restoring backups from $BACKUP_DIR ..."
    (cd "$BACKUP_DIR" && find . -type f -exec cp -a {} "/"{} \; 2>/dev/null) || true
fi

# ---- 6) Kernel boot params -------------------------------------------------------
if [[ "${1:-}" == "--kernel-only" || -z "${1:-}" ]]; then
    log "Reverting kernel boot parameters (edit /etc/default/grub and/or"
    log "  /boot/loader/entries/*.conf manually to remove:"
    log "  zswap.* psi=1 transparent_hugepage=madvise cgroup_enable=memory systemd.unified_cgroup_hierarchy=1)"
    if command -v grub-mkconfig >/dev/null 2>&1 && [[ -f /etc/default/grub ]]; then
        sed -i 's/\bzswap\.[a-z_]*=[^ "]*//g; s/\bpsi=1//g; s/\btransparent_hugepage=[a-z]*//g; s/\bcgroup_enable=memory//g; s/\bsystemd\.unified_cgroup_hierarchy=\d*//g; s/\s\+/ /g' /etc/default/grub || true
        grub-mkconfig -o "$( [ -d /boot/grub ] && echo /boot/grub/grub.cfg || echo /boot/grub2/grub.cfg )" 2>/dev/null || true
    fi
fi

# ---- 7) fstab swap priority -----------------------------------------------------
sed -i 's/,pri=10//' /etc/fstab 2>/dev/null || true

sysctl --system >/dev/null 2>&1
log "Done. Reboot recommended. Backup dir retained at $BACKUP_DIR (remove manually if satisfied)."
exit 0
