#!/bin/sh
# Launch an AppImage the normal way (FUSE mount, NOT --appimage-extract-and-run) as the current non-root
# user and check that it stays up and that the squashfs really is FUSE-mounted.
# --no-sandbox is passed: the AppImage has no setuid chrome-sandbox and no AppArmor profile for its
# mount path, so on Ubuntu 24.04 (userns restricted) the sandbox cannot start. The .deb is the sandboxed path.
# Needs libfuse2 and a display: run under xvfb-run -a or on a desktop session.
# Usage: check-appimage-fuse-launch.sh <path/to/App.AppImage>
set -eu
appimage=${1:?usage: check-appimage-fuse-launch.sh <AppImage>}
tmp=$(mktemp -d)
chmod +x "$appimage"
"$appimage" --no-sandbox --user-data-dir="$tmp/data" --enable-logging=stderr >"$tmp/log" 2>&1 &
pid=$!

mount_line=""
i=0
while [ -z "$mount_line" ] && [ $i -lt 30 ] && kill -0 "$pid" 2>/dev/null; do
  sleep 1
  i=$((i + 1))
  mount_line=$(grep -E ' /tmp/\.mount_[^ ]+ fuse' /proc/self/mounts || true)
done
# Let the window load so a late crash shows up.
[ -z "$mount_line" ] || sleep 10
alive=0
kill -0 "$pid" 2>/dev/null && alive=1
echo "mount: ${mount_line:-<none>}"
# The Electron processes run from the FUSE mount; stop them all so the mount can go away.
mnt=$(echo "$mount_line" | cut -d' ' -f2)
[ -z "$mnt" ] || pkill -f "$mnt/" 2>/dev/null || true
kill "$pid" 2>/dev/null || true
if [ "$alive" != 1 ] || [ -z "$mount_line" ]; then
  tail -n 20 "$tmp/log"
  rm -rf "$tmp" 2>/dev/null || true
  echo "FAIL: AppImage did not stay up on a FUSE mount"
  exit 1
fi
rm -rf "$tmp" 2>/dev/null || true
echo "OK: AppImage ran from a FUSE mount"
