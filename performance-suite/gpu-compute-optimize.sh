#!/usr/bin/env bash
# gpu-compute-optimize.sh — GPU stack for max compute. Detects vendor.
# Surface Laptop 4: AMD Radeon (Vega) iGPU -> amdgpu path.
set -Eeuo pipefail
log() { echo "[gpu] $*"; }

VENDOR="none"
lspci 2>/dev/null | grep -qi 'vga\|3d\|display' || true
if lspci 2>/dev/null | grep -qi 'amd/ati\|radeon'; then VENDOR=amd
elif lspci 2>/dev/null | grep -qi 'nvidia'; then VENDOR=nvidia
elif lspci 2>/dev/null | grep -qi 'intel'; then VENDOR=intel
elif [[ -d /sys/class/backlight/apple_backlight ]]; then VENDOR=apple
fi
log "vendor=$VENDOR"

# ---- module options (persist) ----
mkdir -p /etc/modprobe.d
case $VENDOR in
    amd)
        cat > /etc/modprobe.d/60-amdgpu-perf.conf <<'EOF'
# pearOS performance suite — AMDGPU compute/graphics
options amdgpu noretry=0
options amdgpu lockup_timeout=0
options amdgpu gpu_recovery=0
options amdgpu si_support=1 cik_support=1
EOF
        log "amdgpu options written (noretry=0, lockup_timeout=0)"
        ;;
    intel)
        echo 'options i915 enable_psr=0' > /etc/modprobe.d/60-i915-perf.conf
        log "i915 PSR disabled (latency win)"
        ;;
    nvidia)
        echo 'options nvidia NVreg_EnableGpuFirmware=1' > /etc/modprobe.d/60-nvidia-perf.conf
        log "NVIDIA GSP firmware enabled"
        ;;
    apple) log "Apple GPU (asahi) — no module options needed" ;;
    *) log "no discrete/iGPU driver matched" ;;
esac

# ---- Vulkan loader sanity ----
command -v vulkaninfo >/dev/null && vulkaninfo --summary 2>/dev/null | head -20 || log "vulkaninfo not installed (mesa-vulkan-drivers/vulkan-radeon recommended)"

# ---- runtime PM off for benchmark sessions (persist via udev rule) ----
cat > /etc/udev/rules.d/70-gpu-perf.rules <<'EOF'
# GPU runtime PM disabled (performance suite)
ACTION=="add", SUBSYSTEM=="pci", ATTR{class}=="0x030000", ATTR{power/control}="on"
ACTION=="add", SUBSYSTEM=="pci", ATTR{class}=="0x038000", ATTR{power/control}="on"
EOF
udevadm control --reload 2>/dev/null || true
for d in /sys/bus/pci/devices/*/power/control; do
    cls=$(cat "${d%/power/control}/class" 2>/dev/null || echo 0)
    case "$cls" in 0x0300*|0x0380*) echo on > "$d" 2>/dev/null || true ;; esac
done
log "runtime PM disabled for GPU"

# ---- hugepages for GPU allocations (amd/pdf GEM uses TTM; enable reserve) ----
HP=$(awk '/HugePages_Total/{print $2}' /proc/meminfo)
if [[ ${HP:-0} -eq 0 ]]; then
    echo 64 > /proc/sys/vm/nr_hugepages 2>/dev/null && log "64 hugepages pre-allocated for GPU/TTM" \
        || log "hugepages unavailable (fragmented memory) — skipped"
fi
log "done (module options apply after reload/reboot)"
