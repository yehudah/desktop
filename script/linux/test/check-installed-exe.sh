#!/bin/sh
# Runs inside the installed-e2e image: start the installed app under xvfb as the current
# user and check that /proc/<pid>/exe resolves inside the package's install location.
set -eu
dir=$(dirname "$(readlink -f /usr/bin/github-desktop)")
xvfb-run -a /usr/bin/github-desktop --no-sandbox --user-data-dir="$(mktemp -d)" >/dev/null 2>&1 &
sleep 15
fail=1
for pid in $(pgrep -f "$dir/github-desktop"); do
  exe=$(readlink "/proc/$pid/exe")
  echo "pid=$pid uid=$(id -u) exe=$exe"
  case "$exe" in "$dir"/*) fail=0 ;; *) fail=1; break ;; esac
done
pkill -f "$dir/github-desktop" || true
[ "$fail" = 0 ] && echo "OK: exe inside $dir" || { echo "FAIL"; exit 1; }
