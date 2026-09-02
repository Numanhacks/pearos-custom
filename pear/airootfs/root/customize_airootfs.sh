#!/usr/bin/env bash
#This script runds inside airootfs chroot during build
# it's executed automatically by mkarchiso

set -e -u

# Non-interactive error reporting: there is no TTY in CI builds, so ask_continue
# (which used to read from /dev/tty) would hang the build forever. Fail loudly
# instead so the error is visible in the CI log.
fail_continue() {
	local error_msg="$1"
	echo ""
	echo "ERROR: $error_msg (continuing — check the build log!)"
	echo ""
}

echo "==========================="
echo "Customizing pearOS Live env"
echo "==========================="

echo "Setting OS release"
echo "pearOS" > /etc/arch-release && \
	echo "OS release updated" ||\
	echo "Failed to set OS release"
echo "26.1" > /etc/pearos-release && echo "pearOS version 26.1 stamped" || true
# Global menu: ensure KWin appmenu is enabled for macOS-like global menu
mkdir -p /etc/skel/.config
kwriteconfig5 --file /etc/skel/.config/kwinrc --group Plugins --key kded-appmenuEnabled true 2>/dev/null || true
# Launchpad keybinding: Super triggers pearos-launchpad (if installed)
mkdir -p /etc/skel/.config
cat > /etc/skel/.config/kglobalshortcutsrc.pearos 2>/dev/null <<'KSC'
[pearos-launchpad]
_launchpad=Meta,Meta,Launchpad
KSC


if command -v plymouth-set-default-theme &> /dev/null; then
	echo "Setting plymouth theme"
	plymouth-set-default-theme -R pear-plymouth && \
		echo "Success!" || \
		echo "Failed to set plymouth theme"
else
	echo "Plymouth command theme not found"
fi

echo "############################################################################################################################"
echo "###						REGENERATING PACMAN KEYS					       ###"
echo "############################################################################################################################"
# Ensure gnupg directory exists with correct permissions
mkdir -p /etc/pacman.d/gnupg
chmod 700 /etc/pacman.d/gnupg

# Temporarily disable exit on error for pacman-key operations
set +e

# Initialize pacman keyring if it doesn't exist
if [ ! -d /etc/pacman.d/gnupg/private-keys-v1.d ] || [ ! -f /etc/pacman.d/gnupg/pubring.gpg ]; then
	echo "Initializing pacman keyring..."
	pacman-key --init
	if [ $? -ne 0 ]; then
		fail_continue "pacman-key --init failed"
	fi
fi

# Populate all installed keyrings (archlinux, pearos, ...)
echo "Populating GPG keyrings..."
pacman-key --populate
if [ $? -ne 0 ]; then
	fail_continue "pacman-key --populate failed"
fi

# Re-enable exit on error
set -e

echo "Installing pearOS plasma-welcome (replaces stock version via --overwrite)"
# Retry: this hits the live package repo over the network and CI is flaky.
welcome_ok=0
for attempt in 1 2 3; do
    if pacman -S --noconfirm --overwrite='*' plasma-welcome; then
        welcome_ok=1
        break
    fi
    echo "plasma-welcome install attempt $attempt failed, retrying..."
    sleep 5
done
if [ "$welcome_ok" -eq 1 ]; then
        mkdir -p /etc/skel/.config/autostart
        cp -r /usr/share/applications/welcome.desktop /etc/skel/.config/autostart/welcome.desktop ||:
        echo "plasma-welcome installed successfully"
else
        echo "Failed to install pearOS plasma-welcome (welcome app missing on ISO)"
fi


echo "Fixing permissions"
if chmod -R 0755 /usr/share/extras/; then
        echo "Permissions set!"
else
        echo "Failed to set permissions"
fi


echo "Installing CMake"
if pacman -S --noconfirm cmake extra-cmake-modules; then
        echo "CMake and Extra CMake Modules Installed!"
else
        echo "Failed to install CMake + Extra Modules"
fi

echo "Downloading Liquid Gel"
liquid_ok=0
for attempt in 1 2 3; do
    if git clone --depth 1 https://github.com/pearOS-archlinux/liquid-gel; then
        liquid_ok=1
        break
    fi
    echo "liquid-gel clone attempt $attempt failed, retrying..."
    sleep 5
done

if [ "$liquid_ok" -eq 1 ]; then
        echo "Compiling Liquid Gel"
        if cd liquid-gel && mkdir -p build && cd build && cmake .. -DCMAKE_INSTALL_PREFIX=/usr && make -j$(nproc) && make install; then
                echo "Liquid Gel Compiled..."
        else
                echo "Failed to Compile Liquid Gel - Build Failed — falling back to tuned KWin blur (kwinrc Effect-Blur BlurStrength=12)"
        fi
else
        echo "Failed to download Liquid Gel (kwin effect missing on ISO) — KWin blur fallback active via /etc/skel/.config/kwinrc"
fi



echo "Vendoring WhiteSur themes into the image (first boot then needs no network)"
vendor_theme() {
    local repo="$1" dir="/root/${2:-$1}"
    for attempt in 1 2 3; do
        if git clone --depth 1 "https://github.com/vinceliuice/${repo}.git" "$dir"; then
            return 0
        fi
        echo "theme clone attempt $attempt/3 failed for $repo, retrying..."
        rm -rf "$dir"
        sleep 5
    done
    echo "WARN: could not vendor $repo — pear-ui-polish will fetch it at first boot"
    return 1
}
vendor_theme WhiteSur-kde && \
    (chmod +x /root/WhiteSur-kde/install.sh && /root/WhiteSur-kde/install.sh --global || /root/WhiteSur-kde/install.sh) && \
    echo "WhiteSur KDE theme installed system-wide"
mkdir -p /usr/share/Kvantum
cp -r /root/WhiteSur-kde/Kvantum/* /usr/share/Kvantum/ 2>/dev/null || true
if vendor_theme WhiteSur-gtk-theme; then
    chmod +x /root/WhiteSur-gtk-theme/install.sh 2>/dev/null || true
    /root/WhiteSur-gtk-theme/install.sh --libadwaita 2>/dev/null || /root/WhiteSur-gtk-theme/install.sh || true
fi

# SDDM login theme (shipped inside the WhiteSur-kde repo)
if [ -d /root/WhiteSur-kde/sddm/WhiteSur ]; then
    mkdir -p /usr/share/sddm/themes
    cp -r /root/WhiteSur-kde/sddm/WhiteSur /usr/share/sddm/themes/WhiteSur && \
        printf '[Theme]\nCurrent=WhiteSur\n' > /etc/sddm.conf.d/theme.conf && \
        echo "SDDM theme set to WhiteSur" || \
        echo "WARN: SDDM theme install failed"
fi

# WhiteSur icon theme + wallpapers (macOS icon look / macOS wallpapers)
vendor_theme WhiteSur-icon-theme &&     (chmod +x /root/WhiteSur-icon-theme/install.sh && /root/WhiteSur-icon-theme/install.sh -b /root/WhiteSur-kde/wallpaper ||      /root/WhiteSur-icon-theme/install.sh) && echo "WhiteSur icon theme installed" ||     echo "WARN: icon theme install failed"
if vendor_theme WhiteSur-wallpapers; then
    mkdir -p /usr/share/backgrounds/WhiteSur
    cp -r /root/WhiteSur-wallpapers/4k/* /usr/share/backgrounds/WhiteSur/ 2>/dev/null         || cp -r /root/WhiteSur-wallpapers/1080p/* /usr/share/backgrounds/WhiteSur/ 2>/dev/null || true
fi

# macOS-style cursors (apple_cursor v2.0.1 prebuilt release; not in Arch repos)
CURSOR_URL="https://github.com/ful1e5/apple_cursor/releases/download/v2.0.1/macOS.tar.xz"
if curl -fsSL --retry 3 -o /root/macOS-cursor.tar.xz "$CURSOR_URL"; then
    mkdir -p /usr/share/icons
    tar -xf /root/macOS-cursor.tar.xz -C /usr/share/icons/ && \
        mkdir -p /usr/share/icons/default && \
        printf '[Icon Theme]\nInherits=macOS\n' > /usr/share/icons/default/index.theme && \
        mkdir -p /etc/skel/.config && \
        printf '[Mouse]\ncursorTheme=macOS\n' > /etc/skel/.config/kcminputrc && \
        echo "macOS cursor theme installed" || \
        echo "WARN: macOS cursor extraction failed"
else
    echo "WARN: could not download macOS cursors"
fi

echo "Apple branding: replacing pear logos with the Apple logo"
APPLE_SVG=/root/Apple_logo_black.svg
apple_ok=0
if curl -fsSL --retry 3 -o "$APPLE_SVG" \
    "https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg"; then
    apple_ok=1
    # White version for boot splash (plymouth backgrounds are dark): recolor
    # by setting the presentation fill on the root svg element.
    sed 's/<svg /<svg fill="white" /' "$APPLE_SVG" > /root/apple-white.svg
    if command -v rsvg-convert >/dev/null 2>&1; then
        rsvg-convert -w 512 -h 512 -o /root/apple-white.png /root/apple-white.svg
        rsvg-convert -w 512 -h 512 -o /root/apple-black.png "$APPLE_SVG"
    fi
fi

if [ "$apple_ok" -eq 1 ] && [ -f /root/apple-white.png ]; then
    # Boot splash: replace pear/macOS-logo images shipped by plymouth themes.
    find /usr/share/plymouth/themes -type f \( -iname "*pear*.png" -o -iname "*logo*.png" \) 2>/dev/null | \
        while read -r f; do cp /root/apple-white.png "$f" && echo "branding: $f"; done
    # Icon theme / pixmaps: pearOS-branded icons become the Apple logo. Match
    # 'pear' as a word — '*pear*' alone also matched 'appearance' icons.
    find /usr/share/icons /usr/share/pixmaps -type f \( -iname "*pearos*" -o -iname "pear-*" -o -iname "pear_*" -o -iname "*pear.png" -o -iname "*pear.svg" -o -iname "*pear.svgz" \) 2>/dev/null | \
        while read -r f; do
            case "$f" in
                *.png)  [ -f /root/apple-black.png ] && cp /root/apple-black.png "$f" ;;
                *.svg)  cp "$APPLE_SVG" "$f" ;;
                *.svgz) gzip -c "$APPLE_SVG" > "$f" ;;
            esac
            echo "branding: $f"
        done
else
    echo "WARN: Apple logo download/conversion failed — pear logos left in place"
fi

echo "Syncing window corner radius to 8px (Kvantum/aurorae/kwinrc)"
# Enforce 8px across installed WhiteSur themes so square corners don't poke
if [ -d /usr/share/Kvantum ]; then
    find /usr/share/Kvantum -name "*.kvconfig" -o -name "*.kvgconfig" 2>/dev/null | while read -r kv; do
        sed -i 's/^radius=.*/radius=8/; s/^menu_radius=.*/menu_radius=6/; s/^tooltip_radius=.*/tooltip_radius=6/' "$kv" 2>/dev/null || true
        grep -q "^\[General\]" "$kv" 2>/dev/null || echo -e "\n[General]\nradius=8" >> "$kv" 2>/dev/null || true
    done
fi
# Aurorae WhiteSur decoration — unify Radius/MaskRadius to 8
if [ -d /usr/share/aurorae/themes ]; then
    find /usr/share/aurorae/themes -name "*.rc" 2>/dev/null | while read -r rc; do
        sed -i 's/^Radius=.*/Radius=8/; s/^MaskRadius=.*/MaskRadius=8/' "$rc" 2>/dev/null || true
        if ! grep -q "^Radius=" "$rc" 2>/dev/null; then echo "Radius=8" >> "$rc" 2>/dev/null || true; fi
    done
fi
# Ensure kwinrc blur and decoration settings are present (fallback if liquid-gel fails)
mkdir -p /etc/skel/.config
if [ -f /etc/skel/.config/kwinrc ]; then
    kwriteconfig5 --file /etc/skel/.config/kwinrc --group Compositing --key Backend OpenGL 2>/dev/null || true
    kwriteconfig5 --file /etc/skel/.config/kwinrc --group Compositing --key AnimationSpeed 2 2>/dev/null || true
    kwriteconfig5 --file /etc/skel/.config/kwinrc --group Effect-Blur --key BlurStrength 12 2>/dev/null || true
    kwriteconfig5 --file /etc/skel/.config/kwinrc --group Effect-Blur --key NoiseStrength 0 2>/dev/null || true
    kwriteconfig5 --file /etc/skel/.config/kwinrc --group Plugins --key blurEnabled true 2>/dev/null || true
    kwriteconfig5 --file /etc/skel/.config/kwinrc --group org.kde.kdecoration2 --key library org.kde.kwin.aurorae 2>/dev/null || true
    kwriteconfig5 --file /etc/skel/.config/kwinrc --group org.kde.kdecoration2 --key theme WhiteSur-dark 2>/dev/null || true
fi
# Glass panel opacity: ensure WhiteSur panel svg is translucent (60-70%) for blur to read as glass
find /usr/share/plasma/desktoptheme -name "panelbackground.svg*" 2>/dev/null | while read -r svg; do
    sed -i 's/fill-opacity="[^"]*"/fill-opacity="0.65"/; s/stop-opacity="[^"]*"/stop-opacity="0.65"/' "$svg" 2>/dev/null || true
done || true

echo "Applying pearOS optimization stack (memory/performance/desktop-experience)"
# The repo stores these scripts 0644 (Windows checkout); make them executable.
chmod +x /usr/local/bin/pearos-opt-bootstrap /usr/local/bin/pear-ui-polish \
         /usr/local/bin/install-surface-support /usr/local/bin/pearos-update \
         /usr/local/bin/pearos-doctor /usr/local/bin/pearos-pkg-install \
         /usr/local/bin/pearos-glass-tuner \
         /usr/local/lib/pearos-opt/*.sh 2>/dev/null || true
update-desktop-database /usr/share/applications 2>/dev/null || true
if /usr/local/bin/pearos-opt-bootstrap; then
	echo "Optimization stack applied"
else
	echo "WARN: optimization stack had errors - build continues"
fi

echo "Wiring AquaUI and custom apps (calculator, notes, calendar, about-mac, launchpad)"
# Build order matters: AquaUI first (dependency)
for _pkg in pearos-aquaui pearos-calculator pearos-notes pearos-calendar pearos-about-mac pearos-launchpad; do
    if pacman -Ss "^$_pkg$" >/dev/null 2>&1; then
        pacman -S --noconfirm "$_pkg" 2>/dev/null && echo "installed $_pkg from repo" || echo "WARN: pacman -S $_pkg failed"
    else
        echo "SKIP: $_pkg not in pacman repos — will be built via CI pkgbuilds workflow (see .github/workflows)"
    fi
done
# Ensure .desktop files are registered
update-desktop-database /usr/share/applications 2>/dev/null || true
# App icons: if AquaUI apps installed icons, refresh cache
gtk-update-icon-cache -f /usr/share/icons/hicolor 2>/dev/null || true

echo "Cleaning up pearOS Build"

rm -rf /usr/share/{doc,man,info,help}/*
pacman -Scc --noconfirm
if [ ! -L /sbin/init ]; then
    ln -sf /usr/lib/systemd/systemd /sbin/init
fi
echo "Cleanup"
if rm -rf /root/liquid-gel /root/WhiteSur-kde /root/WhiteSur-gtk-theme /root/WhiteSur-icon-theme /root/WhiteSur-wallpapers; then
        echo "Finish cleanup"
else
        echo "Failed to Cleanup files"
fi
echo "==================="
echo "Script run complete"
echo "==================="
sync
