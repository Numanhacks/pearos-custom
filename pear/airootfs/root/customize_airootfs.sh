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
if rm -rf /root/liquid-gel; then
        echo "Finish cleanup"
else
        echo "Failed to Cleanup files"
fi
echo "==================="
echo "Script run complete"
echo "==================="
sync
