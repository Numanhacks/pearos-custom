#!/usr/bin/env bash
# install-desktop-experience.sh — install items 22-40 as systemd services.
# Integrates after memory + performance suites. Each component has uninstall =
# disable its service (configs are additive and backed up by earlier suites).
set -Eeuo pipefail
[[ $EUID -eq 0 ]] || { echo "run as root"; exit 1; }
SD="$(cd "$(dirname "$0")" && pwd)"
LIB=/usr/local/lib/pearos-dx
log() { echo "[dx] $*"; }
mkdir -p "$LIB"

install -Dm755 "$SD/22-compositor.sh"               "$LIB/22-compositor.sh"
install -Dm755 "$SD/23-shell.sh"                    "$LIB/23-shell.sh"
install -Dm755 "$SD/24-app-lifecycle.sh"            "$LIB/24-app-lifecycle.sh"
install -Dm755 "$SD/25-search.sh"                   "$LIB/25-search.sh"
install -Dm755 "$SD/26-continuity.sh"               "$LIB/26-continuity.sh"
install -Dm755 "$SD/27-time-machine.sh"             "$LIB/27-time-machine.sh"
install -Dm755 "$SD/28-recovery.sh"                 "$LIB/28-recovery.sh"
install -Dm755 "$SD/29-input.sh"                    "$LIB/29-input.sh"
install -Dm755 "$SD/30-audio.sh"                    "$LIB/30-audio.sh"
install -Dm755 "$SD/31-bluetooth.sh"                "$LIB/31-bluetooth.sh"
install -Dm755 "$SD/32-print-a11y.sh"               "$LIB/32-print-a11y.sh"
install -Dm755 "$SD/34-security-power.sh"           "$LIB/34-security-power.sh"
install -Dm755 "$SD/36-38-ime-update-terminal.sh"   "$LIB/36-38-ime-update-terminal.sh"
install -Dm755 "$SD/39-40-shortcuts-spotlight.sh"   "$LIB/39-40-shortcuts-spotlight.sh"

# generate unit files for every component script
mkunit() { # mkunit <scriptname> <Description> [After]
    local name="$1" desc="$2" after="${3:-multi-user.target}"
    cat > "/etc/systemd/system/pearos-${name}.service" <<EOF
[Unit]
Description=pearOS desktop experience: ${desc}
Documentation=file:///usr/local/share/pearos-dx/README.md
After=${after}
[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=${LIB}/$1
[Install]
WantedBy=${after}
EOF
}
install -Dm644 "$SD/pearos-compositor.service" /etc/systemd/system/pearos-compositor.service
mkunit shell.sh            "unified shell: dark mode, accents, notifications"  graphical.target
mkunit app-lifecycle.sh    "bundles (Flatpak) + app lifecycle"                 multi-user.target
mkunit search.sh           "Spotlight-equivalent indexer"                      multi-user.target
mkunit continuity.sh       "KDE Connect ecosystem"                             multi-user.target
mkunit time-machine.sh     "snapshot backup system"                            multi-user.target
mkunit recovery.sh         "recovery tooling"                                  multi-user.target
mkunit input.sh            "input stack: gestures, palm rejection"             multi-user.target
mkunit audio.sh            "PipeWire low-latency audio"                        multi-user.target
mkunit bluetooth.sh        "Bluetooth stack tuning"                            multi-user.target
mkunit print-a11y.sh       "IPP printing + accessibility"                      multi-user.target
mkunit security-power.sh   "firewall, TPM/LUKS helper, battery health"         multi-user.target
mkunit ime-update-terminal.sh "IME, atomic updates, terminal"                  multi-user.target
mkunit shortcuts-spotlight.sh "shortcuts + KRunner spotlight"                  graphical.target

systemctl daemon-reload
# one-shot configurators: run once at install; graphically-tied ones enable for boot
for s in app-lifecycle search continuity time-machine recovery input audio bluetooth \
         print-a11y security-power ime-update-terminal; do
    systemctl enable --now "pearos-${s}.service" || true
done
systemctl enable --now pearos-compositor.service pearos-shell.service \
                      pearos-shortcuts-spotlight.service 2>/dev/null || true
log "desktop experience layer installed (22-40). uninstall: systemctl disable pearos-*"
