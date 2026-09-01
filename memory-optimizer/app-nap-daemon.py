#!/usr/bin/env python3
# ============================================================================
# app-nap-daemon.py — macOS "App Nap" for Linux via cgroup v2 freezer.
#
# Lifecycle for graphical apps not focused for a while:
#   >60s unfocused   -> freeze  (cgroup.freeze = 1, tier1)
#   >5min unfocused  -> keep frozen + proactive reclaim/swap (tier2)
#   >30min unfocused -> deep reclaim, allow full swap-out (tier3, never killed)
#   focus event      -> instant unfreeze back to root cgroup
#
# Focus detection (best-effort, DE-agnostic, tried in order):
#   1. GNOME Shell  (gdbus org.gnome.Shell Eval)
#   2. KDE KWin     (gdbus org.kde.KWin + kdotool fallback)
#   3. X11 generic  (xprop _NET_ACTIVE_WINDOW)
#   4. Fallback     /proc CPU-time deltas + /dev/input/event* activity
#
# Requires: cgroup v2 unified hierarchy, root (via app-nap.service).
# ============================================================================
import os
import re
import sys
import time
import signal
import select
import logging
import subprocess

FREEZE_AFTER   = int(os.environ.get("APPNAP_FREEZE_AFTER", "60"))
COMPRESS_AFTER = int(os.environ.get("APPNAP_COMPRESS_AFTER", "300"))
SWAP_AFTER     = int(os.environ.get("APPNAP_SWAP_AFTER", "1800"))
POLL_INTERVAL  = int(os.environ.get("APPNAP_POLL_INTERVAL", "60"))
CGROOT         = "/sys/fs/cgroup"
NAPROOT        = f"{CGROOT}/app-nap.slice"
TIERS          = {1: f"{NAPROOT}/tier1", 2: f"{NAPROOT}/tier2", 3: f"{NAPROOT}/tier3"}

WHITELIST_RES = [
    r"^(systemd|dbus|dbus-daemon|dbus-broker)$",
    r"^(gnome-shell|kwin_wayland|kwin_x11|Xorg|Xwayland|plasmashell|ksmserver|kded5|kded6)$",
    r"^(pipewire|pipewire-pulse|pipewire-media-session|wireplumber|pulseaudio|pavucontrol)$",
    r"^(sshd|NetworkManager|systemd-resolved|systemd-logind|systemd-udevd|systemd-journald|systemd-oomd)$",
    r"^(sddm|gdm|lightdm|xdg-desktop-portal.*|xdg-document-portal|xdg-permission-store)$",
    r"^(mpv|vlc|rhythmbox|audacious|celluloid|elisa|spotify)$",
    r"^(wget|curl|aria2c|qbittorrent|transmission|ktorrent|deluge)$",
    r"^(pacman|apt|dpkg|dnf|flatpak|snapd|packagekitd|unattended-upgrade)$",
    r"^(app-nap-daemon|python3|bash|sh)$",
    r".*(kwin_wayland|Xwayland|gnome-shell).*",
]
WHITELIST = [re.compile(p) for p in WHITELIST_RES]

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("app-nap")

# --------------------------- cgroup v2 helpers ------------------------------
def write_file(path, data):
    try:
        with open(path, "w") as f:
            f.write(data)
        return True
    except (OSError, PermissionError) as e:
        log.warning("write %s failed: %s", path, e)
        return False

def read_file(path):
    try:
        with open(path) as f:
            return f.read()
    except OSError:
        return ""

def ensure_tiers():
    os.makedirs(NAPROOT, exist_ok=True)
    for t in TIERS.values():
        os.makedirs(t, exist_ok=True)

def cgroup_procs(path):
    return [int(x) for x in read_file(f"{path}/cgroup.procs").split()]

def move_to_tier(pid, tier_path):
    return write_file(f"{tier_path}/cgroup.procs", str(pid))

def set_frozen(tier_path, frozen):
    write_file(f"{tier_path}/cgroup.freeze", "1" if frozen else "0")

def unfreeze_pid(pid):
    for t in TIERS.values():
        set_frozen(t, False)
    ok = write_file(f"{CGROOT}/cgroup.procs", str(pid))
    if ok:
        log.info("unfroze pid=%d (focus)", pid)
    return ok

def reclaim_tier(tier_path, fraction):
    cur = read_file(f"{tier_path}/memory.current")
    try:
        nbytes = int(int(cur) * fraction)
        if nbytes > 0:
            write_file(f"{tier_path}/memory.reclaim", str(nbytes))
    except ValueError:
        pass

# --------------------------- process helpers --------------------------------
def proc_name(pid):
    raw = read_file(f"/proc/{pid}/cmdline").split("\x00")
    if raw and raw[0]:
        return os.path.basename(raw[0])
    return os.path.basename(read_file(f"/proc/{pid}/comm").strip() or "unknown")

def is_whitelisted(pid):
    return any(rx.match(proc_name(pid)) for rx in WHITELIST)

def is_alive(pid):
    return os.path.isdir(f"/proc/{pid}")

def proc_cpu_ticks(pid):
    fields = read_file(f"/proc/{pid}/stat").split()
    if len(fields) > 14:
        try:
            return int(fields[13]) + int(fields[14])
        except (ValueError, IndexError):
            return 0
    return 0

# --------------------------- focus detection --------------------------------
def _gdbus(args):
    try:
        return subprocess.run(["gdbus", *args], capture_output=True, text=True,
                              timeout=3).stdout
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        return ""

def focused_pid_gnome():
    out = _gdbus(["call", "--session", "-d", "org.gnome.Shell",
                  "-o", "/org/gnome/Shell", "-m", "org.gnome.Shell.Eval",
                  "global.display.focus_window ? "
                  "String(global.display.focus_window.get_pid()) : '0'"])
    m = re.search(r"'(\d+)'", out)
    return int(m.group(1)) if m and int(m.group(1)) > 0 else None

def focused_pid_kwin():
    out = _gdbus(["call", "--session", "-d", "org.kde.KWin", "-o", "/KWin",
                  "-m", "org.kde.KWin.queryWindowInfo"])
    m = re.search(r"pid[^0-9]*?(\d+)", out, re.S)
    if m and int(m.group(1)) > 0:
        return int(m.group(1))
    try:
        wid = subprocess.run(["kdotool", "getactivewindow"], capture_output=True,
                             text=True, timeout=3).stdout.strip()
        if wid:
            pidout = subprocess.run(["kdotool", "getwindowpid", wid],
                                    capture_output=True, text=True,
                                    timeout=3).stdout.strip()
            if pidout.isdigit() and int(pidout) > 0:
                return int(pidout)
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        pass
    return None

def focused_pid_x11():
    try:
        wid = subprocess.run(["xprop", "-root", "_NET_ACTIVE_WINDOW"],
                             capture_output=True, text=True, timeout=3).stdout
        m = re.search(r"window id # (0x[0-9a-f]+)", wid)
        if not m:
            return None
        pidout = subprocess.run(["xprop", "-id", m.group(1), "_NET_WM_PID"],
                                capture_output=True, text=True, timeout=3).stdout
        m2 = re.search(r"=\s*(\d+)", pidout)
        return int(m2.group(1)) if m2 and int(m2.group(1)) > 0 else None
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        return None

def get_focused_pid():
    return focused_pid_gnome() or focused_pid_kwin() or focused_pid_x11()

class InputMonitor:
    """Fallback: watch /dev/input/event* — any input event means the user is
    active right now. Combined with /proc CPU deltas, idle apps are nap
    candidates when DE focus tracking is unavailable."""
    def __init__(self):
        self.fds = {}
        try:
            for fn in os.listdir("/dev/input"):
                if fn.startswith("event"):
                    fd = os.open(f"/dev/input/{fn}", os.O_RDONLY | os.O_NONBLOCK)
                    self.fds[fd] = fn
            if self.fds:
                log.info("input monitor: watching %d event devices", len(self.fds))
        except OSError as e:
            log.warning("input monitor unavailable: %s", e)

    def has_activity(self):
        if not self.fds:
            return False
        try:
            r, _, _ = select.select(list(self.fds), [], [], 0.05)
            return bool(r)
        except (OSError, ValueError):
            return False

    def close(self):
        for fd in self.fds:
            try:
                os.close(fd)
            except OSError:
                pass

# --------------------------- main daemon ------------------------------------
class AppNap:
    def __init__(self):
        self.state = {}          # pid -> {"tier": int, "since": float}
        self.cpu_prev = {}       # pid -> cpu ticks at last poll (fallback mode)
        self.input = InputMonitor()
        self.session_leader_focused = None

    # -- nap candidate discovery --------------------------------------------
    def candidates(self):
        """All non-whitelisted, user-space processes (excluding kernel threads)."""
        out = []
        for pid_s in os.listdir("/proc"):
            if not pid_s.isdigit():
                continue
            pid = int(pid_s)
            if pid == os.getpid():
                continue
            if is_whitelisted(pid):
                continue
            if not read_file(f"/proc/{pid}/cmdline").strip():
                continue   # kernel thread
            out.append(pid)
        return out

    def discover_focus(self):
        pid = get_focused_pid()
        if pid:
            return pid
        return None

    # -- tier transitions -----------------------------------------------------
    def nap(self, pid, now):
        log.info("napping pid=%d (%s) after %ds unfocused",
                 pid, proc_name(pid), int(now - self.state.get(pid, {}).get("since", now)))
        if move_to_tier(pid, TIERS[1]):
            set_frozen(TIERS[1], True)
            self.state[pid] = {"tier": 1, "since": now}

    def promote(self, pid, now):
        st = self.state.get(pid)
        if not st:
            return
        age = now - st["since"]
        if st["tier"] == 1 and age >= COMPRESS_AFTER:
            if move_to_tier(pid, TIERS[2]):
                set_frozen(TIERS[2], True)
                reclaim_tier(TIERS[2], 0.5)   # push ~50% to zram/swap
                st["tier"] = 2
                log.info("pid=%d -> tier2 (compressed/swap-priority)", pid)
        elif st["tier"] == 2 and age >= SWAP_AFTER:
            if move_to_tier(pid, TIERS[3]):
                set_frozen(TIERS[3], True)
                reclaim_tier(TIERS[3], 0.95)  # deep reclaim; may fully swap
                st["tier"] = 3
                log.info("pid=%d -> tier3 (deep swap, still alive)", pid)

    def unfocus_sweep(self, focused_pid, now, fallback_idle):
        for pid in list(self.state):
            if not is_alive(pid):
                self.state.pop(pid, None)
                continue
            if pid == focused_pid:
                unfreeze_pid(pid)
                self.state.pop(pid, None)
                continue
            self.promote(pid, now)

        for pid in self.candidates():
            if pid == focused_pid or pid in self.state:
                continue
            if fallback_idle is not None:
                # fallback mode: nap only if CPU-quiet for the whole window
                if fallback_idle.get(pid):
                    self.nap(pid, now)
            else:
                self.nap(pid, now)

    def measure_idle(self, now):
        """Fallback idle detection: CPU-quiet since last poll AND no user input."""
        idle = {}
        user_active = self.input.has_activity()
        for pid in self.candidates():
            ticks = proc_cpu_ticks(pid)
            prev = self.cpu_prev.get(pid)
            self.cpu_prev[pid] = ticks
            idle[pid] = (prev is not None and ticks == prev) and not user_active
        # prune stale cpu entries
        for pid in list(self.cpu_prev):
            if not is_alive(pid):
                del self.cpu_prev[pid]
        return idle

    def shutdown(self):
        log.info("shutting down: unfreezing all napped processes")
        for pid in list(self.state):
            if is_alive(pid):
                unfreeze_pid(pid)
        self.input.close()


def main():
    if os.geteuid() != 0:
        log.error("must run as root (see app-nap.service)")
        return 1
    ensure_tiers()
    nap = AppNap()

    def on_term(_sig, _frm):
        nap.shutdown()
        sys.exit(0)
    signal.signal(signal.SIGTERM, on_term)
    signal.signal(signal.SIGINT, on_term)

    # Detect focus backend once; fall back to CPU/input heuristics
    backend = "unknown"
    if focused_pid_gnome():
        backend = "gnome"
    elif focused_pid_kwin():
        backend = "kwin"
    elif focused_pid_x11():
        backend = "x11"
    else:
        backend = "fallback(cpu+input)"
    log.info("App Nap started. focus backend: %s | freeze>%ds compress>%ds swap>%ds",
             backend, FREEZE_AFTER, COMPRESS_AFTER, SWAP_AFTER)

    last_sweep = 0.0
    while True:
        now = time.time()
        focused = None
        fallback_idle = None

        if backend != "fallback(cpu+input)":
            focused = nap.discover_focus()
            if focused is None:
                # session may be Wayland-only w/o Eval; degrade to fallback
                fallback_idle = nap.measure_idle(now)
        else:
            fallback_idle = nap.measure_idle(now)

        if now - last_sweep >= POLL_INTERVAL:
            nap.unfocus_sweep(focused, now, fallback_idle)
            last_sweep = now

        time.sleep(5)   # light tick: keeps focus restore responsive on sweep

if __name__ == "__main__":
    sys.exit(main())


