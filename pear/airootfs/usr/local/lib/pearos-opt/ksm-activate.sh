#!/usr/bin/env bash
# ============================================================================
# ksm-activate.sh — Enable Kernel Same-page Merging with aggressive scanning.
# pages_to_scan=1000, sleep_millisecs=50. Idempotent.
# ============================================================================
set -Eeuo pipefail
KSM=/sys/kernel/mm/ksm

[[ -d $KSM ]] || { echo "[ksm] KSM not supported by this kernel — skipping (non-fatal)." >&2; exit 0; }

echo 1000 > "$KSM/pages_to_scan" 2>/dev/null || true
echo 50   > "$KSM/sleep_millisecs" 2>/dev/null || true
# 0 = merge across all VMAs (aggressive); run=false pages still merged
echo 0    > "$KSM/merge_across_nodes" 2>/dev/null || true
echo 1    > "$KSM/run"

echo "[ksm] KSM enabled: pages_to_scan=$(cat "$KSM/pages_to_scan") sleep_ms=$(cat "$KSM/sleep_millisecs")"
exit 0
