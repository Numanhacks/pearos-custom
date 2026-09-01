# macOS-Style Memory Management for Linux (pearOS-ready)

Transforms a standard Linux desktop (Ubuntu/Debian/Fedora/Arch, kernel 5.15+,
cgroup v2) into a macOS-like memory-managed system: aggressive compression,
pressure-based lifecycle management, and near-zero perceived slowdown on
**4 GB – 16 GB RAM**.

## Components

| File | Installs to | What it does |
|---|---|---|
| `optimize-memory.sh` | (master) | Detects distro, installs packages, orchestrates everything, rolls back on failure |
| `apply-kernel-params.sh` | — | Persists `zswap`/`psi`/`THP`/cgroup-v2 boot params to GRUB **and** systemd-boot |
| `99-macos-memory.conf` | `/etc/sysctl.d/` | VM tunables: swappiness, cache pressure, writeback, page-cluster 0 |
| `setup-zram.sh` + `zram-setup.service` | `/usr/local/sbin/` + systemd | zram0 = min(50% RAM, 8 GB), zstd, priority 100; disk swap demoted to pri=10 |
| `oomd.conf` + drop-ins | `/etc/systemd/oomd.conf*` | **systemd-oomd** kills on memory pressure >60% for >20s, or swap >90% — never on spikes |
| `ksm-activate.sh` + `ksm.service` + `ksm.timer` | systemd | KSM aggressive scanning (1000 pages / 50 ms), re-asserted after wake |
| `app-nap.service` + `app-nap-daemon.py` | systemd + `/usr/local/lib/app-nap/` | "App Nap": freezes unfocused apps via cgroup-v2 freezer |

## Install

```bash
sudo ./optimize-memory.sh      # then REBOOT (boot params need it)
sudo ./restore-defaults.sh     # full revert any time
```

## Memory hierarchy (expected behavior)

Inactive app memory flows through **four stages, cheapest first**:

1. **Compressed in RAM** — zswap (25% RAM pool, zstd) + App Nap tier2/3 reclaim
2. **zram swap** — 50% RAM compressed-RAM swap, priority 100 (no disk I/O)
3. **Disk swap** — priority 10 (HDD/SSD pagefile equivalent)
4. **Kill** — only under *sustained* extreme pressure (systemd-oomd: 60% PSI for 20 s, or 90% swap), never a spike; `sshd`/`dbus`/`systemd` protected.

## Verify it's working

```bash
zramctl                                   # zram0: SIZE ~50% RAM, ALGORITHM zstd
cat /proc/swaps                           # zram0 priority 100, disk swap 10
cat /sys/kernel/debug/zswap/stored_pages  # grows > 0 = zswap compressing
cat /sys/kernel/debug/zswap/pool_total_size
oomctl                                    # systemd-oomd state + monitored units
systemctl status app-nap                  # daemon active; check journal for tier moves
journalctl -t app-nap -f                  # live: "napping pid=... -> tier2"
cat /sys/kernel/mm/ksm/run                # 1 = KSM active
cat /sys/kernel/mm/ksm/pages_sharing      # deduplicated pages
```

App Nap tiers: `cat /sys/fs/cgroup/app-nap.slice/tier*/cgroup.procs`
Frozen = tier cgroup has `cgroup.freeze = 1`.

## Focus detection (App Nap)

Tried in order — first one that answers wins:

1. **GNOME Wayland/X11** — `gdbus org.gnome.Shell.Eval` (needs `EvalEnabled` on newer GNOME; see below)
2. **KDE Plasma** — `gdbus org.kde.KWin.queryWindowInfo` + `kdotool` fallback
3. **X11 generic** — `xprop _NET_ACTIVE_WINDOW`
4. **Fallback (any WM/Wayland compositor)** — `/proc/<pid>/stat` CPU-time deltas + activity on `/dev/input/event*`: apps that are CPU-quiet while the user is idle get napped.

### Troubleshooting
- **GNOME 41+**: `Eval` is disabled by default. Enable once:
  `gsettings set org.gnome.shell development-tools true` or run the daemon with `MUTTER_DEBUG`-free session; otherwise the daemon automatically degrades to fallback mode (still safe — worst case an unfocused app naps slightly earlier/later).
- **Wayland-only KWin**: `queryWindowInfo` requires an interactive call context; `kdotool` (XWayland) covers most cases, otherwise fallback mode engages.
- **Check which backend is live**: `journalctl -t app-nap | grep "focus backend"`.
- **Restore latency**: tier transitions poll every 60 s; unfreeze happens on the next tick (≤5 s). For hard <100 ms restore on focus, wire a DE hotkey/extension that runs `echo 0 > /sys/fs/cgroup/app-nap.slice/tier*/cgroup.freeze && cat tier*/cgroup.procs >> /sys/fs/cgroup/cgroup.procs`.
- **An app feels stuck frozen**: `sudo systemctl restart app-nap` (daemon unfreezes everything on shutdown).

## Requirements & safety
- cgroup v2 unified hierarchy (mandatory — verified at install).
- Kernel 5.15+ (verified at install).
- All scripts **idempotent**; master installer **rolls back** on any failure.
- Whitelist protects compositors, audio, downloads, package managers, SSH, DBus.
- App Nap **never kills** — only freezes; oomd is the only killer and only under sustained pressure.
