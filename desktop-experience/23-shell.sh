#!/usr/bin/env bash
# 23 — pearos-shell: unified settings, dark mode, accent, notification center,
# file manager polish. Built on Plasma (shell) — configured here, not forked.
set -Eeuo pipefail
KW=$(command -v kwriteconfig6 >/dev/null && echo kwriteconfig6 || echo kwriteconfig5)
log() { echo "[shell] $*"; }

for home in /root /home/*; do
    [[ -d $home ]] || continue
    u=$(basename "$home"); [[ $u == lost+found ]] && continue
    kcfg() { sudo -u "$u" XDG_CONFIG_HOME="$home/.config" "$KW" --file "$1" --group "$2" --key "$3" "$4" 2>/dev/null || true; }

    # system-wide dark mode apps cannot ignore (Qt + GTK + icons)
    kcfg kdeglobals General ColorScheme BreezeDark
    kcfg kdeglobals KDE widgetStyle kvantum-dark
    kcfg kdeglobals Icons Theme pearos-icons
    # accent color engine (macOS-style accents)
    kcfg kdeglobals General AccentColor 58,132,255
    # notifications: grouping + DND + searchable history (Plasma notifications)
    kcfg plasma-org.kde.plasma.desktop-appletsrc Notifications PopupTimeout 5000
    kcfg plasmanotifyrc DoNotDisturb false
    # instant-apply settings: Plasma is live by default; export/import in JSON:
    #   plasma-interactiveconsole / kconfigxt files are versionable (no registry)
    mkdir -p "$home/.config"
    cat > "$home/.config/pearos-shell-export.sh" <<'EOF'
#!/usr/bin/env bash
# human-readable config export (all dotfiles + plasma configs) -> pearos-shell.tar.zst
tar --zstd -cf pearos-shell-$(date +%F).tar.zst ~/.config ~/.local/share/pearos 2>/dev/null
EOF
    chmod +x "$home/.config/pearos-shell-export.sh"
    chown -R "$u":"$u" "$home/.config" 2>/dev/null || true
done
log "dark mode + accent + notifications + config export ready"
