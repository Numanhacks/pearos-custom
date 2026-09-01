# pearOS Desktop Experience Layer (items 22–41)

**Smoothing app-open stutter** (your main ask) is covered by: compositor
animation tuning + GPU rendering (22), KWin effects sanity from ui-polish,
app-nap freezing background apps so foreground launches get full CPU (24),
zram keeping cache hot (memory suite), and KRunner <100ms launcher (40).

## Honest architecture note
pearOS builds on **KDE Plasma + KWin (Wayland)** — the largest open-source
desktop stack. Items 22–40 configure these to macOS-level polish rather than
fork them. Configs are plain dotfiles (no registry), version-controllable.

## Feature comparison (honest)
| Feature | PearOS | Windows 11 | macOS |
|---|---|---|---|
| Smooth 120Hz GPU compositor | ✅ KWin Wayland | ✅ DWM | ✅ |
| Fractional HiDPI per monitor | ✅ | ⚠️ | ✅ |
| VRR (1–120Hz adaptive) | ✅ | ✅ | ✅ (ProMotion) |
| HDR pipeline | ⚠️ KWin 6 beta | ✅ | ✅ |
| Tiling windows built-in | ✅ | ⚠️ Snap layouts | ❌ (3rd party) |
| Spotlight / search <100ms | ✅ KRunner+Baloo | ⚠️ | ✅ |
| Notifications center + DND | ✅ | ✅ | ✅ |
| Dark mode apps can't ignore | ✅ | ⚠️ | ✅ |
| App bundles, clean uninstall | ✅ Flatpak | ⚠️ MSIX | ✅ |
| Sandbox + capability perms | ✅ portals | ✅ | ✅ |
| 60s freeze / 5min compress bg apps | ✅ app-nap | ❌ | ✅ App Nap |
| Clipboard/handoff/AirDrop | ✅ KDE Connect | ⚠️ Phone Link | ✅ |
| Snapshot backups + file time-travel | ✅ snapper/restic | ✅ | ✅ |
| FDE + TPM keyless unlock | ✅ LUKS+TPM2 | ✅ | ✅ |
| Default-deny firewall UI | ✅ nftables | ✅ | ✅ |
| Sub-5ms pro audio | ✅ PipeWire | ⚠️ | ✅ CoreAudio |
| LDAC/aptX/LE Audio | ✅ | ⚠️ | ⚠️ |
| AirPrint-style driverless | ✅ IPP | ⚠️ | ✅ |
| Screen reader day-one | ✅ Orca | ✅ | ✅ |
| Battery 80% health cap | ✅ | ⚠️ | ✅ (optimized charging) |
| Atomic updates + rollback | ✅ snapper hook | ✅ | ✅ |
| No cloud account required | ✅ | ❌ | ❌ |
| IME CJK/Indic GPU candidates | ⚠️ fcitx5 | ✅ | ✅ |
| Local dictation/voice | ❌ roadmap | ✅ | ✅ |
| Live captions any audio | ❌ roadmap | ✅ | ✅ (Apple silicon) |
| Custom Vulkan compositor | ❌ roadmap | — | — |

## What's real config vs. roadmap
- ✅ **Shipped here (22–40):** VRR, fractional scaling, 120fps-class animations,
  tiling, dark/accent/notifications, Flatpak bundles + portals + app-nap,
  Baloo spotlight + battery guard, KDE Connect, snapper/restic backups,
  recovery tooling, libinput gestures/palm rejection, PipeWire low-latency +
  HRTF + LDAC/aptX, BlueZ LE Audio, IPP printing, Orca + reduce-motion,
  nftables + TPM LUKS + battery health + hibernate-after-3h, fcitx5, pacman
  snapshot hook, Meta+Space spotlight + screenshots.
- ❌ **Honest roadmap (needs real development, not config):** custom Vulkan
  compositor, HDR full pipeline on all GPUs, per-app network permissions UI,
  voice dictation, live captions, ".pear" bundle format (Flatpak covers this),
  GPU-rendered IME candidate windows.

## Install / uninstall
```bash
sudo ./install-desktop-experience.sh      # everything, ordered services
systemctl disable --now pearos-<name>.service   # uninstall any component
```
Config writes are backed up by ui-polish/restore-defaults.sh machinery.
