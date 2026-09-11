#!/usr/bin/env bash
set -euo pipefail

DURATION=${1:-30}
LABEL=${2:-"run"}

echo "=================================================="
echo "YTM Benchmark Monitor: Recording for ${DURATION}s (${LABEL})"
echo "=================================================="

CPU_SAMPLES=()
TEMP_SAMPLES=()

get_cpu_temp() {
  if command -v sensors >/dev/null 2>&1; then
    sensors 2>/dev/null | awk '/Tctl:/ {print $2}' | tr -d '+°C' | head -n 1 || echo "0"
  else
    cat /sys/class/thermal/thermal_zone0/temp 2>/dev/null | awk '{print $1/1000}' || echo "0"
  fi
}

get_browser_cpu() {
  # Aggregate CPU% across brave/chrome renderer processes
  ps aux | grep -E "(chrome|brave)" | grep -v grep | awk '{sum+=$3} END {print sum+0}'
}

get_browser_mem() {
  # Aggregate RSS memory in MB across brave/chrome processes
  ps aux | grep -E "(chrome|brave)" | grep -v grep | awk '{sum+=$6} END {printf "%.1f", sum/1024}'
}

echo "Sampling every 1s..."
for ((i=1; i<=DURATION; i++)); do
  CURR_TEMP=$(get_cpu_temp)
  CURR_CPU=$(get_browser_cpu)
  CURR_MEM=$(get_browser_mem)
  
  printf "[%02ds/%02ds] Browser CPU: %5.1f%% | Browser RAM: %6.1f MB | CPU Temp: %s°C\n" "$i" "$DURATION" "$CURR_CPU" "$CURR_MEM" "$CURR_TEMP"
  sleep 1
done

echo "=================================================="
echo "Benchmark completed for: ${LABEL}"
echo "=================================================="
