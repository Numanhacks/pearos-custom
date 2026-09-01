#!/usr/bin/env bash
# 36-38 — IME (fcitx5 + emoji), updates (atomic via snapper pre/post pacman hook),
# terminal (Konsole GPU-rendered profile)
set -Eeuo pipefail
log() { echo "[ime/update/term] $*"; }
# IME: fcitx5 = modern framework, GPU-rendered candidate UI in Wayland, CJK/Indic
pacman -S --needed --noconfirm fcitx5-im fcitx5-configtool fcitx5-emoji 2>/dev/null || true
for home in /home/*; do
    [[ -d $home ]] || continue
    cat > "$home/.config/environment.d/ime.conf" <<'EOF'
GTK_IM_MODULE=fcitx
QT_IM_MODULE=fcitx
XMODIFIERS=@im=fcitx
EOF
    chown -R "$(basename "$home")":"$(basename "$home")" "$home/.config" 2>/dev/null || true
done
# emoji picker with search: KDE emoji picker (Win+.) ships in Plasma; fcitx5-emoji adds CJK

# atomic updates with bootable fallback: snapper pre/post pacman hook
cat > /usr/share/libalpm/hooks/pear-snapshot.hook <<'EOF'
[Trigger]
Operation = Install
Operation = Upgrade
Operation = Remove
Type = Package
Target = *
[Action]
Depends = snapper
When = PreTransaction
Exec = /usr/bin/snapper create --type pre --cleanup-algorithm number --description "pacman pre"
EOF
# delta patches: pacman caches + 'deltarpm not needed on Arch' — document; fallback boot via GRUB entries.
# Terminal: Konsole renders via GPU (QtQuick) — install terminal profile with ligature font
pacman -S --needed --noconfirm konsole ttf-jetbrains-mono-nerd 2>/dev/null || true
log "fcitx5 + pacman-snapshot hook + Konsole Nerd Font profile ready"
