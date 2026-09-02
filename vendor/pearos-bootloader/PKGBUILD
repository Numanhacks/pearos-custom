# Maintainer: pearOS-archlinux
# Based on the official Arch Linux 'refind' PKGBUILD, adapted to build
# pearOS's Ploader fork instead of upstream rEFInd.

pkgname=pearos-bootloader
pkgver=26.7
pkgrel=6
pkgdesc="pearOS's Ploader boot manager (fork of rEFInd)"
arch=('x86_64')
url='https://github.com/pearOS-archlinux/pearos-bootloader'
license=('GPL3')
makedepends=('bash' 'dosfstools' 'efibootmgr' 'gnu-efi' 'git')
depends=('bash' 'dosfstools' 'efibootmgr')
optdepends=('gptfdisk: for finding non-vfat ESP with ploader-install'
            'openssl: for generating local certificates with ploader-install'
            'sbsigntools: for EFI binary signing with ploader-install'
            'sudo: for privilege elevation in ploader-install')
# No #commit= pin on purpose: this always builds whatever is currently on
# the default branch on GitHub. Bump pkgver/pkgrel by hand when you want a
# new build to actually pick up the latest commit (makepkg source caching
# won't re-clone otherwise).
source=("git+$url.git"
        "ploader-install"
        "ploader-mkrlconf"
        "ploader-sync-kernel")
sha256sums=('SKIP' 'SKIP' 'SKIP' 'SKIP')

# NOTE: unlike the official Arch 'refind' PKGBUILD, no gnu-efi-4.x /
# --output-target compat patches are needed here — this fork already
# carries its own fixes (PearOSReallocatePool, AsciiStrLen guard, and
# Make.common already uses --output-target).

build() {
	cd "$srcdir/$pkgname"
	make
}

package() {
	cd "$srcdir/$pkgname"

	# main EFI binary + tools
	install -Dm644 ploader/ploader_x64.efi "$pkgdir/usr/share/$pkgname/ploader_x64.efi"
	install -Dm644 gptsync/gptsync_x64.efi "$pkgdir/usr/share/$pkgname/tools_x64/gptsync_x64.efi"

	# sample config + sbat
	install -Dm644 ploader.conf-sample "$pkgdir/usr/share/$pkgname/ploader.conf-sample"
	install -Dm644 ploader-sbat.csv "$pkgdir/usr/share/$pkgname/ploader-sbat.csv"
	install -Dm644 ploader-sbat-local.csv "$pkgdir/usr/share/$pkgname/ploader-sbat-local.csv"

	# hardcoded theme (icons, background, font, selection art) + boot chime
	cp -r theme "$pkgdir/usr/share/$pkgname/theme"
	install -Dm644 bootsound.wav "$pkgdir/usr/share/$pkgname/bootsound.wav"

	# EFI filesystem drivers (btrfs, ext2/3/4, ntfs, xfs, ...) -- without
	# these Ploader can only read the FAT32 ESP itself and finds no OS
	# entries when /boot lives on a non-FAT root (e.g. Arch's default
	# btrfs layout). Source dir is "efifs-drivers", not "drivers_x64":
	# `make clean` does `rm -rf drivers_x64/*`, which would wipe checked-in
	# binaries living there. ploader-install still expects them installed
	# under drivers_x64/ at runtime, so that's the destination name here.
	install -Dm644 efifs-drivers/*.efi -t "$pkgdir/usr/share/$pkgname/drivers_x64/"

	# install scripts (adapted from upstream refind-install / mkrlconf)
	install -Dm755 "$srcdir/ploader-install" "$pkgdir/usr/bin/ploader-install"
	install -Dm755 "$srcdir/ploader-mkrlconf" "$pkgdir/usr/bin/ploader-mkrlconf"
	install -Dm755 "$srcdir/ploader-sync-kernel" "$pkgdir/usr/bin/ploader-sync-kernel"

	# docs + license
	install -Dm644 README.md "$pkgdir/usr/share/doc/$pkgname/README.md"
	install -Dm644 README.txt "$pkgdir/usr/share/doc/$pkgname/README.txt"
	install -Dm644 BUILDING.txt "$pkgdir/usr/share/doc/$pkgname/BUILDING.txt"
	install -Dm644 CREDITS.txt "$pkgdir/usr/share/doc/$pkgname/CREDITS.txt"
	install -Dm644 LICENSE.txt "$pkgdir/usr/share/licenses/$pkgname/LICENSE.txt"
	install -Dm644 COPYING.txt "$pkgdir/usr/share/licenses/$pkgname/COPYING.txt"
}
