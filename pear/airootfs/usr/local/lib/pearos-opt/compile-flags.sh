#!/usr/bin/env bash
# compile-flags.sh — system-wide compiler optimization + performance kernel recipe.
set -Eeuo pipefail
log() { echo "[compile] $*"; }

# ---- makepkg / environment flags ----
mkdir -p /etc/profile.d
cat > /etc/profile.d/pear-perf-flags.sh <<'EOF'
# pearOS performance suite — compiler flags (-march=native: do NOT ship binaries built with this)
export CFLAGS="-O3 -march=native -mtune=native -fomit-frame-pointer -pipe"
export CXXFLAGS="$CFLAGS"
export LDFLAGS="-Wl,-O1 -Wl,--as-needed"
export MAKEFLAGS="-j$(nproc)"
EOF
chmod +x /etc/profile.d/pear-perf-flags.sh
log "profile flags written (-march=native, -O3, LTO-ready LDFLAGS)"

# ---- LTO helper for makepkg (Arch) ----
if [[ -f /etc/makepkg.conf ]]; then
    grep -q '^OPTIONS=.*lto' /etc/makepkg.conf || \
        sed -i 's/^OPTIONS=(/OPTIONS=(lto /' /etc/makepkg.conf
    log "makepkg LTO enabled"
fi

# ---- BOLT (post-link optimizer) if present ----
command -v llvm-bolt >/dev/null && log "llvm-bolt available — apply per-binary: llvm-bolt <bin> -o <out> -reorder-blocks=ext-tsp" \
    || log "llvm-bolt not installed (optional)"

# ---- performance kernel build recipe (config fragment + build script) ----
cat > /usr/local/share/pear-kernel-fragment <<'EOF'
# Merge into .config: scripts/kconfig/merge_config.sh pear-kernel-fragment
CONFIG_PREEMPT_DYNAMIC=y
CONFIG_HZ_1000=y
CONFIG_HZ=1000
CONFIG_CPU_FREQ_DEFAULT_GOV_PERFORMANCE=y
CONFIG_TRANSPARENT_HUGEPAGE_MADVISE=y
# strip debug weight
CONFIG_DEBUG_INFO_NONE=y
CONFIG_DEBUG_INFO_BTF=n
CONFIG_KASAN=n
CONFIG_KCSAN=n
CONFIG_LOCKDEP=n
CONFIG_PROVE_LOCKING=n
# scheduler knobs
CONFIG_SCHED_AUTOGROUP=y
CONFIG_CFS_BANDWIDTH=y
EOF

cat > /usr/local/bin/build-pear-kernel <<'EOF'
#!/usr/bin/env bash
# Minimal performance kernel build (Arch pacman-style) using the fragment.
set -euo pipefail
: "${KERNEL_SRC:?export KERNEL_SRC=/usr/lib/modules/$(uname -r)/build or a kernel tree}"
cd "$KERNEL_SRC"
scripts/kconfig/merge_config.sh -m .config /usr/local/share/pear-kernel-fragment
make olddefconfig
make -j"$(nproc)"
command -v pacman >/dev/null && {
    make modules_install
    cp -v arch/x86/boot/bzImage /boot/vmlinuz-pear-perf
    echo "Add a boot entry for /boot/vmlinuz-pear-perf (grub-mkconfig or loader entry)."
}
EOF
chmod +x /usr/local/bin/build-pear-kernel
log "kernel recipe: /usr/local/share/pear-kernel-fragment + build-pear-kernel (PREEMPT_DYNAMIC, 1000Hz, perf default governor)"
log "done"
