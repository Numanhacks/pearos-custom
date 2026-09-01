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
                echo "Failed to Compile Liquid Gel - Build Failed"
        fi
else
        echo "Failed to download Liquid Gel (kwin effect missing on ISO)"
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
if vendor_theme WhiteSur-Qt-style-theme; then
    mkdir -p /usr/share/Kvantum
    cp -r /root/WhiteSur-Qt-style-theme/Kvantum/"-"* /usr/share/Kvantum/ 2>/dev/null || \
    cp -r /root/WhiteSur-Qt-style-theme/Kvantum/* /usr/share/Kvantum/ 2>/dev/null || true
fi
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

echo "Applying pearOS optimization stack (memory/performance/desktop-experience)"
if /usr/local/bin/pearos-opt-bootstrap; then
	echo "Optimization stack applied"
else
	echo "WARN: optimization stack had errors - build continues"
fi

echo "Cleaning up pearOS Build"

rm -rf /usr/share/{doc,man,info,help}/*
pacman -Scc --noconfirm
if [ ! -L /sbin/init ]; then
    ln -sf /usr/lib/systemd/systemd /sbin/init
fi
echo "Cleanup"
if rm -rf /root/liquid-gel /root/WhiteSur-kde /root/WhiteSur-Qt-style-theme /root/WhiteSur-gtk-theme; then
        echo "Finish cleanup"
else
        echo "Failed to Cleanup files"
fi
echo "==================="
echo "Script run complete"
echo "==================="
sync
