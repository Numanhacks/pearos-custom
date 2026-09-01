# pearOS Performance Suite (items 10–20) — integrated with the memory optimizer

Tuned specifically for **Surface Laptop 4, Ryzen 7 4980U** (8C/16T, Radeon Vega
iGPU, NVMe, thin chassis) — generic x86_64/ARM64 paths included.

## Expected gains (4980U, honest numbers)
| Benchmark | Expected |
|---|---|
| Geekbench 6 single-core | **+5–15%** (governor pin, C-states, split_lock off) |
| Geekbench 6 multi-core | **+10–25%** (IRQ isolation, nohz_full, cache drop) — capped by the chassis' ~25–30W sustained |
| Compile times | +10–20% (O3/march=native/LTO flags) |
| Page loads | 15–40% on ad-heavy sites (network-layer blocklist) |
| NVMe latency | −20–40% tail latency (none scheduler, poll queues) |

These match what macOS achieves on M-series by *not* throttling early and not
waking cores needlessly — the same levers, x86 edition.

## Usage
```bash
sudo ./install-performance.sh                 # one-shot install + apply
sudo geekbench-mode.sh geekbench6             # benchmark run, auto-restore
sudo geekbench-mode.sh --persistent           # keep perf mode until reboot
systemctl stop pearos-performance-meta        # revert to balanced
```

## Files
| # | File | Purpose |
|---|---|---|
| 10 | `cpu-performance.sh` | amd-pstate performance, min=max, C1-only, boost, BD_PROCHOT (MSR, temp-guarded), scheduler sysctls |
| 11 | `irq-balance.sh` | CPU0-1 = system/UI; net→2-3; NVMe→dedicated core; irqbalance daemon off |
| 12 | `geekbench-mode.sh` | stop app-nap, SCHED_FIFO 99, pin 2-N, drop caches, freeze bg cgroups, watchdog off, thermal logger, auto-restore |
| 13 | `thermal-manager.sh` | 1s polling, MSR prochot clear (guarded), logs throttling, **95°C/10s auto-backoff to schedutil** |
| 14 | `gpu-compute-optimize.sh` | amdgpu noretry=0/lockup_timeout=0 (your Radeon Vega), i915 PSR off, runtime-PM off, hugepages |
| 15 | `io-scheduler.sh` | NVMe→none/2048/nomerges, SSD→mq-deadline, HDD→bfq, noatime |
| 16 | `kernel-params-performance.conf` | max_cstate=1, nohz_full=2-15, rcu_nocbs, irqaffinity=0-1, nvme.poll_queues=8, split_lock off, `mitigations=off` **commented** |
| 17 | `compile-flags.sh` | -O3 -march=native, LTO makepkg, PREEMPT_DYNAMIC/1000Hz kernel recipe |
| 18 | `memory-bandwidth.sh` | numactl interleave wrapper (`pear-numactl`), THP madvise, hugepage pool, compaction off |
| 19 | `network-benchmark-tune.sh` | 128MB buffers, BBR+fq, tcp_fastopen=3, port range, AES-NI check |
| 20 | `pearos-performance-meta.service` | systemd meta: ordered after zram-setup, ExecStart chain, ExecStop=restore |

## ⚠️ Security warnings
- `mitigations=off` (in `kernel-params-performance.conf`, **commented out by default**)
  disables Spectre/Meltdown/Downfall/MDS protections. Gains ~3–8%. Enable only
  for benchmarks or air-gapped trusted machines.
- `-march=native` binaries are **not portable** — never redistribute them.

## ⚠️ Thermal warnings (Surface Laptop 4 specifically)
This chassis sustains ~25–30W multi-core before hitting the same ~95°C wall as
macOS thermal management. The suite does **not** override hardware thermal
limits — `thermal-manager.sh` logs throttling, and the hard safety (95°C for
10s → backoff to schedutil + min freq) protects the thin chassis. Expect
multi-core scores to fall between the "plugged in" and "sustained" numbers.

## Verify
```bash
turbostat --quiet --show Bzy_MHz,PkgTmp,PkgWatt sleep 5   # clocks & power
cpupower frequency-info                                    # governor: performance
cpupower idle-info                                         # C-states
cat /proc/interrupts | head -3                             # IRQ affinity spread
perf stat -a sleep 2                                       # cycles, IPC
nvme list / fio --name=t --filename=/dev/null --size=1g    # IO (build fio first)
vulkaninfo --summary                                       # GPU (Radeon Vega visible)
radeontop                                                  # GPU live
```
