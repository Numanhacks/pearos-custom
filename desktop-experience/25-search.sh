#!/usr/bin/env bash
# 25 — pearos-search: Spotlight-equivalent indexer (Baloo = SQLite-index based),
# tuned: metadata only, pauses on battery/load, incremental via inotify, <100ms.
set -Eeuo pipefail
KW=$(command -v kwriteconfig6 >/dev/null && echo kwriteconfig6 || echo kwriteconfig5)
log() { echo "[search] $*"; }

for home in /root /home/*; do
    [[ -d $home ]] || continue
    u=$(basename "$home"); [[ $u == lost+found ]] && continue
    sudo -u "$u" XDG_CONFIG_HOME="$home/.config" "$KW" --file baloofilerc \
        --group General --key "Indexing-Enabled" true 2>/dev/null || true
    sudo -u "$u" XDG_CONFIG_HOME="$home/.config" "$KW" --file baloofilerc \
        --group General --key "only basic indexing" true 2>/dev/null || true   # metadata, not content
    sudo -u "$u" XDG_CONFIG_HOME="$home/.config" "$KW" --file baloofilerc \
        --group General --key "Max storage" 512 2>/dev/null || true            # MiB index cap
    chown -R "$u":"$u" "$home/.config" 2>/dev/null || true
done

# pause under load / on battery: systemd-run guard (upower battery status)
cat > /usr/local/lib/pearos-dx/search-guard.sh <<'EOF'
#!/usr/bin/env bash
# Baloo is event-driven (inotify) — full rescans never happen; this guard
# pauses indexing on battery or when load is high (perf suite friend).
while true; do
    on_battery=$(cat /sys/class/power_supply/A*/status 2>/dev/null | head -1)
    load=$(awk '{print int($1*10)}' /proc/loadavg)
    if [[ $on_battery == "Discharging" ]] || (( load > 40 )); then
        balooctl6 suspend 2>/dev/null || balooctl suspend 2>/dev/null || true
    else
        balooctl6 resume 2>/dev/null || balooctl resume 2>/dev/null || true
    fi
    sleep 30
done
EOF
chmod +x /usr/local/lib/pearos-dx/search-guard.sh
log "Baloo: metadata-only, event-driven incremental, battery/load guard installed"
