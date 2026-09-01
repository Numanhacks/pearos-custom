# Surface Laptop 4 (AMD) on pearOS — hardware support matrix

Your device: Surface Laptop 4 13.5"/15" AMD (Ryzen 7 4980U, Radeon Vega iGPU,
NVMe SSD, Surface Type Keyboard, Precision touchpad, Surface Pen support, USB-C/USB-A).

## Install (from pearOS/Arch)
```bash
sudo ./install-surface-support.sh   # adds linux-surface repo + kernel + drivers
reboot                              # select "Linux (surface)" in boot menu
```

## What each piece does
| Component | Covers |
|---|---|
| `linux-surface` kernel | **Keyboard + touchpad** (they're behind the SAM embedded controller, not plain USB!), function keys, battery/thermal sensors, throttling tables, S0ix sleep |
| `iptsd` | Touch + Surface Pen digitizer (pressure, tilt, palm rejection) |
| `libwacom-surface` | Correct touchpad/pen device profiles |
| `surface-dtx-daemon` | Device states (keyboard backlight, posture) |
| `surface-control` | CLI: `surface-control list`, thermal/fan info |
| `linux-firmware` | Wi-Fi/BT/NVMe firmware blobs |
| Performance suite (items 10-20) | amd-pstate, C-states, GPU — applies on the surface kernel too |

## Honest status matrix (SL4 AMD on linux-surface)
| Hardware | Status |
|---|---|
| Keyboard, function keys, brightness/volume keys | ✅ (surface kernel) |
| Precision touchpad (multi-touch, gestures) | ✅ |
| Wi-Fi + Bluetooth | ✅ mainline + linux-firmware |
| NVMe SSD / USB-A / USB-C charging+data | ✅ mainline |
| Radeon Vega graphics (Vulkan/VA-API) | ✅ mesa (already in pearOS pkg list) |
| Speakers/headphones (SOF audio) | ✅ with firmware; mic array ⚠️ sometimes needs UCM tweak |
| Surface Pen | ✅ via iptsd |
| Cameras | ⚠️ hardest part — AMD Surface cameras need libcamera/ipu stack; treat as not-guaranteed |
| Sleep/suspend | ✅ S0ix with surface kernel; hibernate works with swap (zram + disk swap present) |
| Samsung MSN device-firmware update | via `surface-control` / fwupd |

## Sources (all open source)
- linux-surface kernel & packages: https://github.com/linux-surface/linux-surface
- Arch repo: https://pkg.surfacelinux.com/arch/
- Device status wiki: https://github.com/linux-surface/linux-surface/wiki/Device-Compatibility

## Note on "finding MSI drivers online"
Surfaces don't use device-driver MSIs — everything ships via the linux-surface
kernel packages above (that's the correct, supported mechanism; random .msi
drivers are Windows-only). Your performance/memory/ui suites all keep working —
they tune the *system*, which is kernel-independent.
