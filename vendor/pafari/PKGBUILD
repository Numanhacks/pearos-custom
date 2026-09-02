pkgname=pafari
pkgver=26.5.1
pkgrel=1
pkgdesc="Pafari - A simple, clean, beautiful web browser"
arch=('x86_64')
url="https://github.com/pearOS-archlinux/pafari"
license=('GPL3+')
depends=(
  'cairo'
  'gcr-4'
  'gdk-pixbuf2'
  'glib2'
  'gsettings-desktop-schemas'
  'gstreamer'
  'gtk4'
  'iso-codes'
  'json-glib'
  'libarchive'
  'libadwaita'
  'libsecret'
  'libsoup3'
  'libxml2'
  'nettle'
  'libportal-gtk4'
  'sqlite'
  'webkitgtk-6.0'
)
makedepends=(
  'meson'
  'ninja'
  'gettext'
  'itstool'
  'blueprint-compiler'
  'appstream-glib'
)
# Build din directorul curent (unde e PKGBUILD); nu mai e nevoie de tarball .gz
source=("PKGBUILD")
install=pafari.install
sha256sums=('SKIP')

build() {
  cd "$startdir"
  meson setup . build \
    --prefix=/usr \
    --libdir=lib \
    --buildtype=plain \
    -Ddeveloper_mode=false \
    -Dtech_preview=false \
    -Dprofile='' \
    -Dhelp=false
  ninja -C build
}

package() {
  cd "$startdir"
  DESTDIR="$pkgdir" ninja -C build install
  install -Dm644 /dev/null "$pkgdir/etc/ld.so.conf.d/pafari.conf"
  echo "/usr/lib/epiphany" > "$pkgdir/etc/ld.so.conf.d/pafari.conf"
}
