#!/bin/sh
# Runs as root inside a clean BASE_IMAGE with the .deb at /deb/. Installs AppArmor's userspace
# first (as on a desktop install), then the .deb, and checks what the Chromium sandbox relies on:
# - chrome-sandbox is root:root 4755 (SUID fallback sandbox, set by our postinst)
# - with AppArmor 4 (Ubuntu 24.04+, which restricts unprivileged user namespaces) the distro's
#   apparmor package ships /etc/apparmor.d/github-desktop granting `userns` to exactly our
#   installed binary. We must keep that install path and must not ship our own profile.
# - with older AppArmor (Ubuntu 22.04, Debian 12) there is no such profile and none is needed
set -eu
export DEBIAN_FRONTEND=noninteractive
profile=/etc/apparmor.d/github-desktop
fail() { echo "FAIL: $*"; exit 1; }

apt-get update -qq
apt-get install -y -qq apparmor >/dev/null
for deb in /deb/GitHubDesktop-linux-amd64-*.deb; do break; done
apt-get install -y -qq "$deb" >/tmp/install.log 2>&1 ||
  { tail -n 20 /tmp/install.log; fail "apt install"; }

exe=$(readlink -f /usr/bin/github-desktop)
dpkg -L github-desktop | grep -q '^/etc/apparmor.d/' && fail "package ships an AppArmor profile"
mode=$(stat -c '%a %U:%G' "$(dirname "$exe")/chrome-sandbox")
echo "exe: $exe  chrome-sandbox: $mode"
[ "$mode" = "4755 root:root" ] || fail "chrome-sandbox mode"

if [ -e /etc/apparmor.d/abi/4.0 ]; then
  [ -f "$profile" ] || fail "AppArmor 4 without $profile"
  owner=$(dpkg -S "$profile" | cut -d: -f1)
  echo "$profile owned by: $owner"
  [ "$owner" = apparmor ] || fail "$profile owned by $owner, expected apparmor"
  grep -E '^[[:space:]]*(profile|userns)' "$profile" || true
  grep -q "^profile github-desktop $exe " "$profile" || fail "profile does not attach to $exe"
  grep -q '^[[:space:]]*userns,' "$profile" || fail "profile lacks userns"
else
  [ ! -e "$profile" ] || fail "unexpected $profile"
  echo "AppArmor $(dpkg-query -W -f '${Version}' apparmor): no userns restriction profile needed"
fi
echo "OK"
