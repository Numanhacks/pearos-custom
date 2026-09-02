#!/usr/bin/bash

# Lock the current launch script to prevent multiple instance launch
LOCKFILE="/tmp/calamares.lock"
if [ -e "$LOCKFILE" ] && kill -0 "$(cat $LOCKFILE)" 2>/dev/null; then
    echo "Calamares is already running. Exiting."
    exit 1
fi
echo $$ > "$LOCKFILE"
trap 'rm -f "$LOCKFILE"' EXIT

DIR="/etc/calamares"
KERNEL=$(uname -r)
UNPACKFS="$DIR/modules/unpackfs.conf"

bootmnt_has_airootfs() {
	[[ -f /run/archiso/bootmnt/arch/x86_64/airootfs.sfs ]] ||
		[[ -f /run/archiso/bootmnt/arch/aarch64/airootfs.sfs ]]
}

resolve_airootfs_path() {
	local c found
	for c in \
		"/run/archiso/copytoram/airootfs.sfs" \
		"/run/archiso/bootmnt/arch/x86_64/airootfs.sfs" \
		"/run/archiso/bootmnt/arch/aarch64/airootfs.sfs"
	do
		if [[ -f "$c" ]]; then
			echo "$c"
			return 0
		fi
	done
	found=$(find /run/archiso -name 'airootfs.sfs' -type f 2>/dev/null | head -n1)
	if [[ -n "$found" && -f "$found" ]]; then
		echo "$found"
		return 0
	fi
	return 1
}

# When live skips auto-mount of the ISO (USB/timing), recreate layout from GitHub-workaround threads.
try_mount_archiso_bootmnt() {
	sudo mkdir -p /run/archiso/bootmnt

	if mountpoint -q /run/archiso/bootmnt 2>/dev/null && bootmnt_has_airootfs; then
		return 0
	fi

	local label dev kv
	while IFS= read -r kv; do
		[[ -z "$kv" ]] && continue
		case "$kv" in
			archisolabel=*|archiso.search_label=*)
				label="${kv#*=}"
				label="${label//\"/}"
				[[ -z "$label" ]] && continue
				if [[ -b "/dev/disk/by-label/$label" ]]; then
					if sudo mount -o ro "/dev/disk/by-label/$label" /run/archiso/bootmnt 2>/dev/null; then
						bootmnt_has_airootfs && return 0
						sudo umount /run/archiso/bootmnt 2>/dev/null
					fi
				fi
				;;
			img_dev=*|archiso.img_dev=*)
				dev="${kv#*=}"
				dev="${dev//\"/}"
				if [[ -n "$dev" && -b "$dev" ]]; then
					if sudo mount -o ro "$dev" /run/archiso/bootmnt 2>/dev/null; then
						bootmnt_has_airootfs && return 0
						sudo umount /run/archiso/bootmnt 2>/dev/null
					fi
				fi
				;;
		esac
	done < <(tr ' ' '\n' < /proc/cmdline)

	local name fst
	while read -r name fst; do
		[[ -n "$name" && -b "$name" ]] || continue
		[[ "$fst" == "iso9660" || "$fst" == "udf" ]] || continue
		if sudo mount -o ro "$name" /run/archiso/bootmnt 2>/dev/null; then
			bootmnt_has_airootfs && return 0
			sudo umount /run/archiso/bootmnt 2>/dev/null
		fi
	done < <(lsblk -nrp -o NAME,FSTYPE)

	return 1
}

# Paths differ by boot mode (copytoram, ISO layout, slow USB, custom mkarchiso). Resolve at launch.
AIROOTFS=""
if path=$(resolve_airootfs_path); then
	AIROOTFS=$path
fi
if [[ -z "$AIROOTFS" ]]; then
	try_mount_archiso_bootmnt || true
	if path=$(resolve_airootfs_path); then
		AIROOTFS=$path
	fi
fi
if [[ -z "$AIROOTFS" || ! -f "$AIROOTFS" ]]; then
	echo "Calamares: airootfs.sfs not found under /run/archiso (check live boot / ISO layout)." >&2
	exit 1
fi

KERNEL_IMG="/usr/lib/modules/$KERNEL/vmlinuz"
if [[ ! -f "$KERNEL_IMG" ]]; then
	echo "Calamares: kernel image missing at $KERNEL_IMG" >&2
	exit 1
fi

sudo sed -i \
	-e "s|source: \"[^\"]*airootfs\\.sfs\"|source: \"${AIROOTFS}\"|" \
	-e "s|source: \"[^\"]*vmlinuz-linux\"|source: \"${KERNEL_IMG}\"|" \
	"$UNPACKFS"

# Detect the desktop environment
DE="${XDG_CURRENT_DESKTOP,,}"

if [[ "$DE" == *"gnome"* ]]; then
    sudo calamares -D 8
else
    sudo -E calamares -D 8
fi
