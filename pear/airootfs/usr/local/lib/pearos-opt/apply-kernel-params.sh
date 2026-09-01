#!/usr/bin/env bash
# ============================================================================
# apply-kernel-params.sh — Persist macOS-memory kernel boot parameters for
# GRUB and/or systemd-boot. Idempotent. Must run as root.
# ============================================================================
set -Eeuo pipefail

PARAMS="zswap.enabled=1 zswap.compressor=zstd zswap.max_pool_percent=25 zswap.zpool=zsmalloc zswap.accept_threshold_percent=90 psi=1 transparent_hugepage=madvise cgroup_enable=memory systemd.unified_cgroup_hierarchy=1"

log() { echo "[kparams] $*"; }

ensure_grub() {
    local CFG=/etc/default/grub
    [[ -f $CFG ]] || return 0
    # strip any previous managed entry, then append fresh
    sed -i 's/\bzswap\.[a-z_]*=[^ "]*//g; s/\bpsi=1//g; s/\btransparent_hugepage=[a-z]*//g; s/\bcgroup_enable=memory//g; s/\bsystemd\.unified_cgroup_hierarchy=\d*//g; s/\s\+/ /g' "$CFG" || true
    if grep -qs '^GRUB_CMDLINE_LINUX_DEFAULT=' "$CFG"; then
        sed -i "s|^GRUB_CMDLINE_LINUX_DEFAULT=\"\(.*\)\"|GRUB_CMDLINE_LINUX_DEFAULT=\"\1 $PARAMS\"|" "$CFG"
    else
        echo "GRUB_CMDLINE_LINUX_DEFAULT=\"$PARAMS\"" >> "$CFG"
    fi
    log "GRUB config updated."
    if command -v grub-mkconfig >/dev/null 2>&1; then
        grub-mkconfig -o "$( [ -d /boot/grub ] && echo /boot/grub/grub.cfg || echo /boot/grub2/grub.cfg )" \
            && log "grub.cfg regenerated." || log "WARNING: grub-mkconfig failed; run it manually."
    fi
}

ensure_systemd_boot() {
    local SD=/boot/loader/entries
    [[ -d $SD ]] || return 0
    local f modified=0
    for f in "$SD"/*.conf; do
        [[ -e $f ]] || continue
        grep -q 'zswap.enabled=1' "$f" && continue
        if grep -qs '^options ' "$f"; then
            sed -i "s|^options \(.*\)$|options \1 $PARAMS|" "$f"
        else
            echo "options $PARAMS" >> "$f"
        fi
        modified=1
        log "Updated $(basename "$f")"
    done
    (( modified )) || log "systemd-boot entries already up to date."
}

ensure_grub
ensure_systemd_boot
log "Done. Reboot required for changes to take effect."
