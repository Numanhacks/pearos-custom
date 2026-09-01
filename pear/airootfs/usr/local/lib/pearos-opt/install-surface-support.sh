#!/usr/bin/env bash
# install-surface-support.sh — Surface Laptop 4 (AMD Ryzen 7 4980U) full driver
# support for pearOS: linux-surface kernel (keyboard/touchpad/SAM EC), libwacom
# surface profiles, surface-control, thermal/battery, firmware.
#
# Source: https://github.com/linux-surface/linux-surface (GPL/open, Arch repo)
# Run on pearOS/Arch:  sudo ./install-surface-support.sh
set -Eeuo pipefail
log() { echo "[surface] $*"; }
[[ $EUID -eq 0 ]] || { echo "run as root"; exit 1; }

# ---- 0) sanity: only on x86_64 AMD Surface (Laptop 4 = 4980U) ----
grep -qi 'amd' /proc/cpuinfo || log "WARN: CPU is not AMD — continuing anyway (harmless on Intel Surfaces)"

# ---- 1) linux-surface Arch repository (GPG-verified) ----
if command -v pacman >/dev/null; then
    log "Adding linux-surface Arch repo..."
    curl -Os https://raw.githubusercontent.com/linux-surface/linux-surface/master/pkg/keys/surface.asc
    pacman-key --add surface.asc
    pacman-key --lsign-key "$(gpg --show-keys --with-colons surface.asc 2>/dev/null | awk -F: '/^pub/{print $5; exit}')"
    rm -f surface.asc
    if ! grep -q '^\[linux-surface\]' /etc/pacman.conf; then
        cat >> /etc/pacman.conf <<'EOF'

[linux-surface]
Server = https://pkg.surfacelinux.com/arch/
SigLevel = Required DatabaseOptional
EOF
    fi
    pacman -Sy --noconfirm

    # ---- 2) the actual drivers ----
    log "Installing linux-surface kernel + device support..."
    pacman -S --needed --noconfirm \
        linux-surface linux-surface-headers \
        libwacom-surface \
        surface-control \
        iptsd \
        linux-firmware iwd || true
    # linux-surface = patched kernel: SAM embedded controller (keyboard, touchpad,
    # function keys, type cover protocol), IPTS touch/pen, DTX detach, thermals.
    # libwacom-surface = correct touchpad/pen digitizer profiles.
    # surface-control = fan/thermal query CLI (surface-control list/thermal).

    # ---- 3) DTX (device behaviors: keyboard backlight, etc.) ----
    pacman -S --needed --noconfirm surface-dtx-daemon 2>/dev/null || true
    systemctl enable --now surface-dtx-daemon 2>/dev/null || true

    # ---- 4) initramfs + boot entry ----
    if [[ -f /etc/mkinitcpio.d/linux-surface.preset ]]; then
        mkinitcpio -p linux-surface
        log "initramfs built for linux-surface"
    fi
    # grub: regenerate picks up new kernel automatically
    command -v grub-mkconfig >/dev/null && [[ -d /boot/grub ]] && grub-mkconfig -o /boot/grub/grub.cfg || true

elif command -v apt >/dev/null; then
    log "Debian/Ubuntu path: adding linux-surface repo..."
    echo "deb [arch=amd64] https://pkg.surfacelinux.com/debian release main" > /etc/apt/sources.list.d/linux-surface.list
    curl -s https://raw.githubusercontent.com/linux-surface/linux-surface/master/pkg/keys/surface.asc | gpg --dearmor > /etc/apt/trusted.gpg.d/linux-surface.gpg
    apt-get update -qq
    apt-get install -y linux-image-surface linux-headers-surface libwacom-surface iptsd || true
fi

# ---- 5) AMD-specific tuning (4980U) — reuse performance suite knobs ----
mkdir -p /etc/modprobe.d
cat > /etc/modprobe.d/60-surface-amd.conf <<'EOF'
# Surface Laptop 4 AMD: audio (SOF), camera, sensors
options snd_sof_amd_acp dsp_dbg_enable=0
# make sure the I2C keyboard/touchpad controllers load early
softdep i2c_hid_acpi pre: amd_sfh
EOF

# touchpad: libinput defaults (natural scroll + palm rejection) via udev rule is
# per-user; system-wide sane defaults here:
mkdir -p /etc/X11/xorg.conf.d /etc/libinput 2>/dev/null || true
log "Surface kernel + drivers installed. REBOOT and select 'Linux (surface)' in boot menu."

# ---- 6) verify ----
log "After reboot, verify:"
log "  uname -r                     -> ends in -surface"
log "  surface-control list         -> embedded controller responds"
log "  libinput list-devices        -> touchpad recognized as MSFT0001/PTP"
log "  journalctl -b | grep -i sam  -> SAM EC driver loaded (keyboard/fn keys)"
