#!/usr/bin/env bash
# ============================================================================
# oomd-protect.sh — mark critical system services as "avoid" for systemd-oomd.
# Under sustained memory pressure oomd kills the cgroup with the highest
# pressure; sshd/dbus/systemd-logind must be last to die so you can still log
# in and the session bus survives. systemd (PID 1) is not oomd-managed.
# ============================================================================
set -Eeuo pipefail

log() { echo "[oomd-protect] $*"; }

protect() { # protect <unit>
    local unit="$1" dir="/etc/systemd/system/${unit}.d"
    [[ -f "/usr/lib/systemd/system/$unit" ]] || { log "skip $unit (not installed)"; return 0; }
    mkdir -p "$dir"
    cat > "${dir}/50-oomd-avoid.conf" <<'EOF'
[Service]
ManagedOOMPreference=avoid
EOF
    log "protected $unit"
}

protect sshd.service
protect dbus.service
protect dbus-broker.service
protect systemd-logind.service
protect sddm.service

systemctl daemon-reload 2>/dev/null || true
log "done — critical services are oomd 'avoid'"
