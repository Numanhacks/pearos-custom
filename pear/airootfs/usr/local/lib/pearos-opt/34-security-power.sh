#!/usr/bin/env bash
# 34-35 — security (LUKS/secure-boot/nftables default-deny) + power (battery health)
set -Eeuo pipefail
log() { echo "[security/power] $*"; }

# firewall: nftables default-deny inbound, allow established + ping
cat > /etc/nftables.d/pearos-basic.nft 2>/dev/null || mkdir -p /etc/nftables.d
cat > /etc/nftables.d/pearos-basic.nft <<'EOF'
table inet pearos_filter {
  chain input {
    type filter hook input priority 0; policy drop;
    iif lo accept
    ct state established,related accept
    ip protocol icmp accept
    ip6 nexthdr ipv6-icmp accept
  }
  chain forward { type filter hook forward priority 0; policy drop; }
  chain output { type filter hook output priority 0; policy accept; }
}
EOF
systemctl enable --now nftables 2>/dev/null || true

# TPM-backed LUKS: document + enroll helper (no cloud account anywhere)
cat > /usr/local/bin/pear-secure-disk <<'EOF'
#!/usr/bin/env bash
# Enroll TPM2 PCR7 (secure boot state) for keyless-at-boot LUKS:
#   systemd-cryptenroll --tpm2-device=auto --tpm2-pcrs=7 /dev/nvmeXnYpZ
# Full disk encryption is applied at install time by calamares (LUKS2).
set -e
dev=${1:?usage: pear-secure-disk /dev/nvme0n1p2}
systemd-cryptenroll --tpm2-device=auto --tpm2-pcrs=7 "$dev"
echo "TPM2 keyslot enrolled."
EOF
chmod +x /usr/local/bin/pear-secure-disk

# malware scan-on-access lite: clamav-clamonacc optional (off by default, zero cost)
# power: battery health 80% cap (kernel charge_behaviours when supported)
for b in /sys/class/power_supply/BAT*; do
    [[ -w $b/charge_control_end_threshold ]] && echo 80 > "$b/charge_control_end_threshold" 2>/dev/null || true
done
systemctl enable --now power-profiles-daemon 2>/dev/null || true
# hibernate after 3h sleep: systemd suspend-then-hibernate + delay
mkdir -p /etc/systemd/system.conf.d
printf '[Sleep]\nHibernateDelaySec=3h\nSuspendState=mem\n' > /etc/systemd/system.conf.d/50-pearos-sleep.conf
log "nftables default-deny + TPM LUKS helper + battery 80%% + hibernate-after-3h"
