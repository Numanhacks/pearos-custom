#!/usr/bin/env bash
# ============================================================================
# pear-ui-polish.sh — Fix pearOS UI bugs + full macOS theming (incl. the
# Wi-Fi/system-tray popups, which were stock Breeze before).
#
#   sudo ./pear-ui-polish.sh            apply (idempotent)
#   sudo ./pear-ui-polish.sh --revert   restore previous configs (backup dir)
# ============================================================================
set -Eeuo pipefail

MODE="${1:-apply}"
THEME_SRC="/tmp/WhiteSur-kde"
BACKUP="/var/lib/pear-ui-polish/backup"

log() { echo "[ui-polish] $*"; }

backup() {
    local f="$1"
    if [[ -e "$f" && ! -e "$BACKUP$f" ]]; then
        mkdir -p "$BACKUP$(dirname "$f")"
        cp -a "$f" "$BACKUP$f"
    fi
}

users() {
    echo root
    while IFS=: read -r u _ uid _ _ home shell; do
        [[ $uid -ge 1000 && -d $home && $shell != */nologin && $shell != /bin/false ]] && echo "$u"
    done < /etc/passwd
}

kcfg() { # kcfg <user> <tool> <file> <group> <key> <value>
    local u="$1" tool="$2" file="$3" group="$4" key="$5" val="$6"
    local home; home=$(getent passwd "$u" | cut -d: -f6)
    sudo -u "$u" XDG_CONFIG_HOME="$home/.config" "$tool" --file "$file" --group "$group" --key "$key" "$val"
}

pick_tool() {
    command -v kwriteconfig6 >/dev/null && echo kwriteconfig6 || echo kwriteconfig5
}

git_clone_retry() { # git_clone_retry <url> <dest> [required]
    local url="$1" dest="$2" required="${3:-optional}" attempt
    for attempt in 1 2 3; do
        if git clone --depth 1 "$url" "$dest"; then
            return 0
        fi
        log "clone attempt $attempt/3 failed for $url"
        rm -rf "$dest"
        sleep 5
    done
    rm -rf "$dest"
    if [[ $required == required ]]; then
        log "ERROR: could not clone $url — theming incomplete"
    else
        log "WARN: could not clone $url (optional component skipped)"
    fi
    return 1
}

apply_theme() {
    # Themes are vendored into the image at build time; only clone when absent
    # (e.g. running the polish script on an older install or a minimal system).
    if ls /usr/share/plasma/desktoptheme 2>/dev/null | grep -qi whitesur; then
        log "WhiteSur theme already present in image — skipping download."
    else
        log "Fetching WhiteSur KDE theme..."
        rm -rf "$THEME_SRC" "$THEME_SRC-gtk"
        git_clone_retry https://github.com/vinceliuice/WhiteSur-kde.git "$THEME_SRC" required || return 1
        chmod +x "$THEME_SRC/install.sh" 2>/dev/null || true

        log "Installing theme system-wide (window deco + plasma theme + look-and-feel)..."
        "$THEME_SRC/install.sh" --global 2>/dev/null || "$THEME_SRC/install.sh"

        log "Installing Kvantum macOS app style..."
        if ! command -v kvantummanager >/dev/null 2>&1; then
            pacman -S --needed --noconfirm kvantum 2>/dev/null || log "WARN: install kvantum manually"
        fi
        if [[ -d "$THEME_SRC/Kvantum" ]]; then
            mkdir -p /usr/share/Kvantum
            cp -r "$THEME_SRC/Kvantum/"* /usr/share/Kvantum/ 2>/dev/null || true
        fi
    fi

    log "Installing WhiteSur GTK theme (GTK apps: Firefox dialogs, GIMP, Electron)..."
    if ls /usr/share/themes 2>/dev/null | grep -qi whitesur; then
        log "WhiteSur GTK theme already present — skipping download."
    else
        git_clone_retry https://github.com/vinceliuice/WhiteSur-gtk-theme.git "$THEME_SRC-gtk" || true
        if [[ -d "$THEME_SRC-gtk" ]]; then
            chmod +x "$THEME_SRC-gtk/install.sh" 2>/dev/null || true
            "$THEME_SRC-gtk/install.sh" --libadwaita 2>/dev/null \
              || "$THEME_SRC-gtk/install.sh" 2>/dev/null \
              || log "WARN: GTK theme install failed — GTK apps keep old look"
        fi
    fi
}

apply_user_config() {
    local KW; KW=$(pick_tool)
    log "Applying per-user configuration (tool: $KW)..."
    for u in $(users); do
        local home; home=$(getent passwd "$u" | cut -d: -f6)
        mkdir -p "$home/.config"
        for f in kwinrc kwinrulesrc kdeglobals plasmarc; do backup "$home/.config/$f"; done

        # ---- 1) KWin: traffic lights left, no borders, glitchy effects off ----
        kcfg "$u" "$KW" kwinrc org.kde.kdecoration2 library       org.kde.kwin.aurorae
        kcfg "$u" "$KW" kwinrc org.kde.kdecoration2 theme         WhiteSur
        kcfg "$u" "$KW" kwinrc org.kde.kdecoration2 ButtonsOnLeft "Close,Minimize,Maximize"
        kcfg "$u" "$KW" kwinrc org.kde.kdecoration2 ButtonsOnRight ""
        kcfg "$u" "$KW" kwinrc org.kde.kdecoration2 BorderSize    None
        kcfg "$u" "$KW" kwinrc org.kde.kdecoration2 BorderSizeAuto false
        # windows flying under panels caused the overlap artifacts:
        kcfg "$u" "$KW" kwinrc Plugins kwin4_effect_slideEnabled false
        kcfg "$u" "$KW" kwinrc Plugins kwin4_effect_translucencyEnabled false
        kcfg "$u" "$KW" kwinrc Plugins dimscreenEnabled false
        kcfg "$u" "$KW" kwinrc Plugins kwin4_effect_zoomEnabled false
        # keep the macOS-style ones on:
        kcfg "$u" "$KW" kwinrc Plugins blurEnabled true
        kcfg "$u" "$KW" kwinrc Plugins kwin4_effect_fadeEnabled true
        kcfg "$u" "$KW" kwinrc Plugins kwin4_effect_scaleEnabled true
        # macOS snappiness (0.5 ≈ 2x faster than stock)
        kcfg "$u" "$KW" kwinrc KDE AnimationDurationFactor 0.4

        # ---- 2) Window rules: popups and notch above maximized windows ----
        kcfg "$u" "$KW" kwinrulesrc 1 Description "Plasma popups above maximized windows"
        kcfg "$u" "$KW" kwinrulesrc 1 wmclassmatch 3
        kcfg "$u" "$KW" kwinrulesrc 1 wmclass plasmashell
        kcfg "$u" "$KW" kwinrulesrc 1 abovebydefault true
        kcfg "$u" "$KW" kwinrulesrc 1 abovebydefaultrule 2
        kcfg "$u" "$KW" kwinrulesrc 1 types 322
        kcfg "$u" "$KW" kwinrulesrc 2 Description "pearos-notch stays on top"
        kcfg "$u" "$KW" kwinrulesrc 2 wmclassmatch 3
        kcfg "$u" "$KW" kwinrulesrc 2 wmclass pearos-notch
        kcfg "$u" "$KW" kwinrulesrc 2 abovebydefault true
        kcfg "$u" "$KW" kwinrulesrc 2 abovebydefaultrule 2

        # ---- 3) macOS look: THIS is what fixes the Wi-Fi/tray popups ----
        kcfg "$u" "$KW" kdeglobals KDE widgetStyle kvantum-dark
        kcfg "$u" "$KW" kdeglobals Icons Theme pearos-icons
        kcfg "$u" "$KW" kdeglobals KDE LookAndFeelPackage com.github.vinceliuice.WhiteSur-dark
        kcfg "$u" "$KW" plasmarc Theme name com.github.vinceliuice.WhiteSur-dark

        # GTK apps follow the macOS look too
        kcfg "$u" "$KW" gtkrc-2.0 general widget-style "WhiteSur-Dark"
        kcfg "$u" "$KW" "$home/.config/gtk-3.0/settings.ini" Settings gtk-theme-name "WhiteSur-Dark"
        kcfg "$u" "$KW" "$home/.config/gtk-4.0/settings.ini" Settings gtk-theme-name "WhiteSur-Dark"
        kcfg "$u" "$KW" "$home/.config/gtk-3.0/settings.ini" Settings gtk-application-prefer-dark-theme true
        kcfg "$u" "$KW" "$home/.config/gtk-4.0/settings.ini" Settings gtk-application-prefer-dark-theme true

        chown -R "$u":"$u" "$home/.config" 2>/dev/null || true
    done
}

apply() {
    apply_theme
    apply_user_config
    log "Done. Log out/in (or: kquitapp6 plasmashell && kstart plasmashell)."
}

revert() {
    log "Restoring configs from $BACKUP ..."
    ( cd "$BACKUP" && find . -type f -exec cp -a {} "/"{} \; ) 2>/dev/null || true
    log "Done. Log out/in."
}

case "$MODE" in
    apply)     apply ;;
    --revert)  revert ;;
    *) echo "usage: $0 [--revert]"; exit 1 ;;
esac

