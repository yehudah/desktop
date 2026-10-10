#!/bin/bash
# Runs as root inside a clean ubuntu:24.04 (see run-lifecycle-test.sh) with the current .deb at
# /deb/current.deb. Builds an "old" package from it (older version suffix + a marker file that the
# current package does not ship), then: install old -> upgrade to current -> purge -> reinstall.
# At every step checks the dpkg state, desktop file, icon, mime cache entry, /usr/bin symlink and
# chrome-sandbox mode. Files created in the user's home by running the app are not package-owned and
# must survive the purge.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
PKG=github-desktop
LIB=/usr/lib/github-desktop
DESKTOP=/usr/share/applications/github-desktop.desktop
MIMECACHE=/usr/share/applications/mimeinfo.cache
MARKER=$LIB/OLD-ONLY-MARKER
fail() { echo "FAIL: $*"; exit 1; }
step() { echo; echo "=== $* ==="; }

cur=/deb/current.deb
curver=$(dpkg-deb -f "$cur" Version)
oldver="${curver}~prev1"

step "build old package $oldver from $curver"
rm -rf /tmp/old && mkdir /tmp/old
dpkg-deb -R "$cur" /tmp/old/root
sed -i "s/^Version: .*/Version: $oldver/" /tmp/old/root/DEBIAN/control
echo old > "/tmp/old/root$MARKER"
dpkg-deb -Zgzip -b /tmp/old/root /tmp/old/old.deb >/dev/null
dpkg --compare-versions "$oldver" lt "$curver" || fail "old version is not older"

icon_path() { dpkg -L $PKG | grep -E '^/usr/(share/(icons|pixmaps)/.*|lib/github-desktop/resources/app/static/icon-logo)\.png$' | head -n1; }

# check_installed <expected version> <marker expected: yes|no>
check_installed() {
  local ver=$1 marker=$2
  [ "$(dpkg-query -W -f '${Version} ${db:Status-Abbrev}' $PKG)" = "$ver ii " ] || fail "dpkg state: $(dpkg-query -W -f '${Version} ${db:Status-Abbrev}' $PKG)"
  { [ -L /usr/bin/github-desktop ] && [ "$(readlink -f /usr/bin/github-desktop)" = "$LIB/github-desktop" ]; } ||
    fail "/usr/bin symlink: $(readlink /usr/bin/github-desktop || echo missing)"
  [ -x "$LIB/github-desktop" ] || fail "binary missing"
  [ -f "$DESKTOP" ] || fail "desktop file missing"
  grep -q '^Exec=github-desktop %U' "$DESKTOP" || fail "desktop Exec"
  grep -q 'x-scheme-handler/x-github-client' "$DESKTOP" || fail "desktop MimeType"
  local icon; icon=$(grep '^Icon=' "$DESKTOP" | cut -d= -f2)
  [ -n "$icon" ] || fail "desktop has no Icon"
  local ip; ip=$(icon_path); [ -f "$ip" ] || fail "icon file missing ($ip)"
  grep -q '^x-scheme-handler/x-github-client=.*github-desktop.desktop' "$MIMECACHE" || fail "mime cache entry missing"
  [ "$(stat -c '%a %U:%G' $LIB/chrome-sandbox)" = "4755 root:root" ] || fail "chrome-sandbox $(stat -c '%a %U:%G' $LIB/chrome-sandbox)"
  if [ "$marker" = yes ]; then [ -f "$MARKER" ] || fail "marker missing"; else [ ! -e "$MARKER" ] || fail "stale marker present after upgrade"; fi
  echo "ok: $ver  symlink->$(readlink /usr/bin/github-desktop)  Icon=$icon ($ip)  sandbox=$(stat -c '%a %U:%G' $LIB/chrome-sandbox)"
  echo "    mime: $(grep '^x-scheme-handler/x-github-client=' "$MIMECACHE")"
  echo "    dpkg -V: $(dpkg -V $PKG | wc -l) deviations"; dpkg -V $PKG | head
}

step "apt-get update"
apt-get update -qq
# A desktop has desktop-file-utils (update-desktop-database); the postinst/postrm only refresh the
# mime cache when it is present, and the package does not depend on it. Without it no cache exists.
apt-get install -y -qq --no-install-recommends desktop-file-utils >/dev/null

step "1. install old ($oldver)"
apt-get install -y -qq --no-install-recommends /tmp/old/old.deb >/tmp/install-old.log 2>&1 || { tail -20 /tmp/install-old.log; fail "install old"; }
check_installed "$oldver" yes

step "simulate user config created by launching the app"
useradd -m tester
cfg="/home/tester/.config/GitHub Desktop"
su tester -c "mkdir -p '$cfg' && echo '{}' > '$cfg/window-state.json'"
# a stray 0755 sandbox helper must be repaired by the upgrade
chmod 0755 $LIB/chrome-sandbox

step "2. upgrade to current ($curver)"
apt-get install -y -qq --no-install-recommends "$cur" 2>&1 | tail -5
check_installed "$curver" no

step "3. purge"
dpkg -L $PKG | while read -r p; do [ -f "$p" ] || [ -L "$p" ] && echo "$p"; done > /tmp/owned-files.txt
echo "package owns $(wc -l < /tmp/owned-files.txt) files/links"
dpkg -L $PKG | grep -v -x -e / -e /usr -e /usr/bin -e /usr/lib -e /usr/share -e /usr/share/applications -e /usr/share/doc > /tmp/owned-paths.txt
apt-get purge -y -qq $PKG 2>&1 | tail -5
st=$(dpkg-query -W -f '${db:Status-Abbrev}' $PKG 2>/dev/null || echo gone)
echo "dpkg status after purge: '$st'"
case "$st" in gone|"") ;; *) [ "$st" = "un " ] || fail "dpkg state after purge: $st";; esac
# Files and links must be gone. A directory may remain only if another package owns it too.
left=0
while read -r p; do
  [ "$p" = /. ] && continue
  { [ -e "$p" ] || [ -L "$p" ]; } || continue
  if [ -d "$p" ] && [ ! -L "$p" ]; then
    if owner=$(dpkg -S "$p" 2>/dev/null | head -n1); then echo "shared dir kept: $p ($owner)"; continue; fi
    [ -n "$(ls -A "$p")" ] || echo "WARNING: empty unowned dir left: $p"
  fi
  echo "LEFTOVER: $p"; left=$((left+1))
done < /tmp/owned-paths.txt
[ "$left" = 0 ] || fail "$left package-owned paths left after purge"
[ ! -e "$DESKTOP" ] || fail "desktop file left"
[ ! -e /usr/bin/github-desktop ] && [ ! -L /usr/bin/github-desktop ] || fail "/usr/bin symlink left"
[ ! -e $LIB ] || fail "$LIB left"
grep -q 'github-desktop.desktop' "$MIMECACHE" 2>/dev/null && fail "mime cache still mentions github-desktop" || echo "ok: mime cache has no github-desktop entry"
[ -f "$cfg/window-state.json" ] || fail "user config unexpectedly removed"
echo "ok: all $(wc -l < /tmp/owned-paths.txt) package-owned paths gone; user config kept"

step "4. reinstall"
apt-get install -y -qq --no-install-recommends "$cur" >/tmp/install-re.log 2>&1 || { tail -20 /tmp/install-re.log; fail "reinstall"; }
check_installed "$curver" no
[ -f "$cfg/window-state.json" ] || fail "user config missing"

echo; echo "LIFECYCLE OK"
