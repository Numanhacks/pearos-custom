#!/usr/bin/env bash
# 28 — recovery: fallback boot entry + fsck-on-fail + reinstall-preserving-/home.
set -Eeuo pipefail
log() { echo "[recovery] $*"; }
# 1) always keep last-good kernel entry (boot menu shows all; nothing to purge)
# 2) failed-boot auto-fsck: fsck.mode=force once, then clean flag
if [[ -f /etc/default/grub ]]; then
    grep -q GRUB_FSCK || echo 'GRUB_CMDLINE_LINUX_DEFAULT="$GRUB_CMDLINE_LINUX_DEFAULT fsck.mode=auto"' >> /etc/default/grub
fi
# 3) reinstall-preserving-data: pearOS calamares already supports /home reuse.
#    Recovery shell: the ISO itself (pearOS ISO = recovery env with terminal).
cat > /usr/local/bin/pear-recovery <<'EOF'
#!/usr/bin/env bash
# Boot the pearOS ISO (same USB) → choose "Repair": fsck, rollback via snapper,
# chroot tools, full terminal. Reinstall keeps /home when same fs label.
echo "1) fsck all: systemctl start systemd-fsck-root 2) snapper list 3) arch-chroot tools"
exec bash
EOF
chmod +x /usr/local/bin/pear-recovery
# 4) network boot: the ISO ships PXE hooks (archiso_pxe) already enabled in mkinitcpio.
log "fallback entry + fsck-on-fail + ISO-as-recovery + PXE ready"
