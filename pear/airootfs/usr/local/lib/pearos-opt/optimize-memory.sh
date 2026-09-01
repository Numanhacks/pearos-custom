#!/usr/bin/env bash
# ============================================================================
# optimize-memory.sh — Master installer: macOS-style memory management
# Target: Ubuntu 22.04+/Debian 12+/Fedora 38+/Arch (kernel 5.15+), cgroup v2
# Idempotent: safe to run repeatedly. Rolls back on failure.
# Run as root:  sudo ./optimize-memory.sh
# ============================================================================
set -Eeuo pipefail
umask 022
export LC_ALL=C

SCRIPT_DIR="$(cd -- "$(dirname -- "$(readlink -f -- "$0")")" && pwd)"
LOG_TAG="opt-mem"

declare -a ROLLBACK_STEPS=()

log()  { echo "[INFO ] $1"; }
warn() { echo "[WARN ] $1"; }
err()  { echo "[ERROR] $1" >&2; }

# ---- Preflight -------------------------------------------------------------
[[ $EUID -eq 0 ]] || { err "Run as root (sudo)."; exit 1; }

if ! grep -qs '^cgroup2 ' /proc/mounts; then
    err "cgroup v2 (unified hierarchy) not detected. Aborting."
    exit 1
fi
KMAJOR=$(uname -r | cut -d. -f1); KMINOR=$(uname -r | cut -d. -f2)
if (( KMAJOR < 5 || (KMAJOR == 5 && KMINOR < 15) )); then
    err "Kernel $(uname -r) is older than 5.15. Aborting."
    exit 1
fi

# ---- Distro detection ------------------------------------------------------
detect_distro() {
    if grep -qs '^ID=arch' /etc/os-release; then echo "arch"
    elif grep -qsE '^ID=(ubuntu|debian|linuxmint|pop)' /etc/os-release; then echo "debian"
    elif grep -qsE '^ID=(fedora|rhel|rocky|alma|centos)' /etc/os-release; then echo "fedora"
    else echo "unknown"; fi
}
DISTRO=$(detect_distro)
log "Detected distribution: $DISTRO"

install_pkgs() {
    case "$DISTRO" in
        arch)   pacman -Sy --needed --noconfirm python zstd util-linux kmod || return 1 ;;
        debian) export DEBIAN_FRONTEND=noninteractive
                apt-get update -qq && apt-get install -y -qq python3 zstd util-linux kmod || return 1 ;;
        fedora) dnf install -y -q python3 zstd util-linux kmod || return 1 ;;
        *)      warn "Unknown distro: python3/zstd must exist already."
                command -v python3 >/dev/null || { err "python3 missing"; return 1; } ;;
    esac
}

# ---- Rollback machinery -----------------------------------------------------
BACKUP_DIR="/var/lib/optimize-memory/backup"
backup_file() {
    local f="$1"
    if [[ -e "$f" && ! -e "$BACKUP_DIR$f" ]]; then
        mkdir -p "$BACKUP_DIR$(dirname "$f")"
        cp -a "$f" "$BACKUP_DIR$f"
    fi
}
register_rollback() { ROLLBACK_STEPS+=("$1"); }
rollback() {
    err "Failure detected — rolling back all changes..."
    for step in "${ROLLBACK_STEPS[@]}"; do bash -c "$step" 2>/dev/null || true; done
    err "Rollback complete."
    exit 1
}
trap rollback ERR

# ============================================================================
# 1) Packages
# ============================================================================
log "Installing required packages..."
install_pkgs || { err "Package installation failed."; exit 1; }

# ============================================================================
# 2) Kernel boot parameters (zswap / PSI / THP / cgroup v2)
# ============================================================================
log "Applying kernel boot parameters..."
bash "$SCRIPT_DIR/apply-kernel-params.sh" || { err "Kernel param setup failed."; exit 1; }
register_rollback "bash $SCRIPT_DIR/restore-defaults.sh --kernel-only"

# ============================================================================
# 3) sysctl VM tunables
# ============================================================================
log "Applying sysctl tunables..."
install -Dm644 "$SCRIPT_DIR/99-macos-memory.conf" /etc/sysctl.d/99-macos-memory.conf
backup_file /etc/sysctl.d/99-macos-memory.conf
sysctl --system >/dev/null 2>&1 || warn "Some sysctls not applicable on this kernel (ignored)."
register_rollback "rm -f /etc/sysctl.d/99-macos-memory.conf; sysctl --system >/dev/null 2>&1"

# ============================================================================
# 4) zram (50% RAM, zstd, priority 100) — disk swap demoted to priority 10
# ============================================================================
log "Setting up zram..."
bash "$SCRIPT_DIR/setup-zram.sh" || { err "zram setup failed."; exit 1; }
install -Dm644 "$SCRIPT_DIR/zram-setup.service" /etc/systemd/system/zram-setup.service
systemctl daemon-reload
systemctl enable --now zram-setup.service || warn "zram-setup enable failed (will re-run at boot)."
register_rollback "systemctl disable --now zram-setup.service 2>/dev/null; swapoff /dev/zram0 2>/dev/null; true"

# ============================================================================
# 5) systemd-oomd — pressure-based killing
# ============================================================================
log "Configuring systemd-oomd..."
if command -v systemd-oomd >/dev/null 2>&1; then
    mkdir -p /etc/systemd/oomd.conf.d
    install -m644 "$SCRIPT_DIR/oomd.conf" /etc/systemd/oomd.conf
    install -Dm644 "$SCRIPT_DIR/oomd-drop.conf" /etc/systemd/oomd.conf.d/50-macos-memory.conf
    mkdir -p /etc/systemd/system/system.slice.d /etc/systemd/system/user.slice.d /etc/systemd/system/user@.service.d
    install -m644 "$SCRIPT_DIR/oomd-managed.slice.conf" /etc/systemd/system/system.slice.d/50-oomd.conf
    install -m644 "$SCRIPT_DIR/oomd-managed.slice.conf" /etc/systemd/system/user.slice.d/50-oomd.conf
    install -m644 "$SCRIPT_DIR/oomd-managed.slice.conf" /etc/systemd/system/user@.service.d/50-oomd.conf
    systemctl daemon-reload
    systemctl enable --now systemd-oomd.service || warn "systemd-oomd could not be enabled."
    register_rollback "rm -f /etc/systemd/oomd.conf.d/50-macos-memory.conf /etc/systemd/system/system.slice.d/50-oomd.conf /etc/systemd/system/user.slice.d/50-oomd.conf /etc/systemd/system/user@.service.d/50-oomd.conf; systemctl daemon-reload"
else
    warn "systemd-oomd not available — legacy OOM killer remains."
fi

# ============================================================================
# 6) KSM with aggressive scanning + persistence timer
# ============================================================================
log "Enabling KSM (aggressive)..."
bash "$SCRIPT_DIR/ksm-activate.sh" || warn "KSM activation failed (continuing; KSM is optional)."
install -Dm644 "$SCRIPT_DIR/ksm.service" /etc/systemd/system/ksm.service
install -Dm644 "$SCRIPT_DIR/ksm.timer"  /etc/systemd/system/ksm.timer
systemctl daemon-reload
systemctl enable --now ksm.timer || warn "ksm.timer enable failed."
register_rollback "systemctl disable --now ksm.timer 2>/dev/null; true"

# ============================================================================
# 7) App Nap daemon (cgroup-v2 freezer lifecycle for unfocused apps)
# ============================================================================
log "Installing App Nap daemon..."
install -Dm755 "$SCRIPT_DIR/app-nap-daemon.py" /usr/local/lib/app-nap/app-nap-daemon.py
install -Dm644 "$SCRIPT_DIR/app-nap.service"   /etc/systemd/system/app-nap.service
systemctl daemon-reload
systemctl enable --now app-nap.service || { err "app-nap.service failed to start."; exit 1; }
register_rollback "systemctl disable --now app-nap.service 2>/dev/null; for t in tier1 tier2 tier3; do rmdir /sys/fs/cgroup/app-nap.slice/\$t 2>/dev/null; done; rmdir /sys/fs/cgroup/app-nap.slice 2>/dev/null; true"

# ============================================================================
# Done
# ============================================================================
trap - ERR
log "=============================================================="
log " macOS-style memory management installed successfully."
log " Components: zswap(zstd) + zram(50% RAM) + PSI + oomd + KSM + App Nap"
log " REBOOT REQUIRED for kernel boot parameters (zswap/PSI/THP)."
log " Verify after reboot:"
log "   zramctl                                — zram0 present, zstd"
log "   cat /sys/kernel/debug/zswap/stored_pages — zswap active"
log "   systemctl status app-nap               — daemon running"
log "   oomctl                                 — systemd-oomd state"
log "=============================================================="
exit 0

