PKGVER := $(shell grep '^pkgver=' PKGBUILD | cut -d= -f2)
TARBALL := fastfetch-$(PKGVER).tar.gz

.PHONY: all clean
all: $(TARBALL)
	makepkg -f --skipinteg

$(TARBALL):
	tar czf "/tmp/$@" --exclude=build --exclude=pkg --exclude=.git --exclude='*.tar.gz' . && mv "/tmp/$@" "$@"

clean:
	rm -rf build pkg
	rm -rf fastfetch-*.tar.gz src/src src/fastfetch-*.tar.gz
