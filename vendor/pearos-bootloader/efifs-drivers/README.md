EFI filesystem drivers, bundled so Ploader can read kernels/initrds off
non-FAT partitions (btrfs, ext2/3/4, ntfs, xfs, etc) — without them Ploader
can only see the FAT32 ESP itself and finds no OS entries on a typical
Arch/btrfs root layout.

btrfs_x64.efi, ext2_x64.efi, ext4_x64.efi, hfs_x64.efi, iso9660_x64.efi,
reiserfs_x64.efi are the "fsw" (filesystem wrapper) drivers pulled from
Arch's official `refind` package (/usr/share/refind/drivers_x64/) -- these
are rEFInd's own native driver family, not grub-derived, and are the ones
confirmed working against this codebase's ConnectAllDriversToAllControllers()
on real hardware. The generic efifs-sourced drivers we tried first
(grub-derived, from Arch's `extra/efifs` package) build fine and load, but
triggered a firmware hang on connect on at least one INSYDE UEFI -- don't
swap fsw drivers back for efifs ones for these filesystems without solid
evidence the connect-time issue is fixed.

Everything else here (ntfs, xfs, f2fs, exfat, jfs, nilfs2, udf, ufs2, zfs,
affs, bfs, sfs) is still the original efifs build (version 1.12-1, GPL-3.0-
or-later, from https://github.com/pbatard/efifs) since fsw equivalents
aren't available for these -- untested for the same connect-hang risk,
so treat them as unproven if ever exercised.

NOTE: this directory is intentionally named "efifs-drivers", not
"drivers_x64" -- the project's own `make clean` target does
`rm -rf drivers_x64/*`, which would wipe these checked-in binaries every
time someone runs a clean build. PKGBUILD copies them into
`/usr/share/pearos-bootloader/drivers_x64/` at package time, and
`ploader-install` copies them onto the ESP under
`EFI/ploader/drivers_x64/` from there, matching what the compiled binary
actually expects at runtime.
