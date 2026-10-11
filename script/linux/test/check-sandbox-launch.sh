#!/bin/sh
# Start the installed app as the current (non-root) user WITHOUT --no-sandbox and check that
# Chromium's sandbox came up: the sandboxed zygote (renderer/utility zygote) must run in its
# own PID namespace, either via user namespaces or via the SUID chrome-sandbox helper.
# The main window renderer itself runs with --no-sandbox by app design (nodeIntegration).
# Extra args go to the app (e.g. --disable-namespace-sandbox to force the SUID helper).
# Needs a display: run under xvfb-run -a or on a desktop session.
set -eu
dir=$(dirname "$(readlink -f /usr/bin/github-desktop)")
tmp=$(mktemp -d)
/usr/bin/github-desktop --user-data-dir="$tmp/data" --enable-logging=stderr "$@" >"$tmp/log" 2>&1 &
browser=$!

# The sandboxed zygote is the one without --no-zygote-sandbox. With the SUID helper the
# chrome-sandbox wrapper (argv0 chrome-sandbox) is its parent and is skipped here.
# Prints "<pid> <pid namespace>" of the first one whose namespace is readable.
find_zygote() {
  for pid in $(pgrep -f -- "--type=zygote"); do
    case "$(tr '\0' ' ' </proc/"$pid"/cmdline 2>/dev/null)" in
      "$dir/github-desktop "*--no-zygote-sandbox*) ;;
      "$dir/github-desktop "*)
        ns=$(readlink /proc/"$pid"/ns/pid 2>/dev/null) && { echo "$pid $ns"; return; } ;;
    esac
  done
}

found=""
i=0
while [ -z "$found" ] && [ $i -lt 30 ] && kill -0 "$browser" 2>/dev/null; do
  sleep 1
  i=$((i + 1))
  found=$(find_zygote)
done
# Let the window load so a late FATAL shows up in the log. Then look again: early on the
# match can be a short-lived fork of the zygote, so its PID is not reused afterwards.
if [ -n "$found" ]; then
  sleep 5
  found=$(find_zygote)
fi
zygote=${found%% *}
zns=${found#* }
bns=$(readlink /proc/"$browser"/ns/pid 2>/dev/null || true)
pgrep -a -f "^($dir|/usr/bin)/" | cut -c1-160
kill "$browser" 2>/dev/null || true
grep -E 'FATAL|namespace|sandbox' "$tmp/log" | head -n 5
fatal=$(grep -c FATAL "$tmp/log" || true)
# The app's children may still be writing to the profile dir.
rm -rf "$tmp" 2>/dev/null || true
if [ -z "$bns" ] || [ -z "$found" ] || [ "$fatal" != 0 ]; then
  echo "FAIL: app did not start sandboxed (browser ns '$bns', zygote '$found', FATAL lines $fatal)"; exit 1
fi
echo "browser $browser $bns, sandboxed zygote $zygote $zns"
[ "$bns" != "$zns" ] || { echo "FAIL: sandboxed zygote shares the browser PID namespace"; exit 1; }
echo "OK: sandboxed zygote in its own PID namespace"
