#!/usr/bin/env bash
# Runs inside the container as a non-root user: check-keytar.sh <with-keyring|no-keyring>
# with-keyring: dbus session + unlocked gnome-keyring, asserts a keytar set/get/delete round-trip.
# no-unlocked-keyring: session bus but Secret Service auto-activated but locked, recorded likewise.
# no-keyring:   no session bus / Secret Service, records how keytar fails (never fails the script).
set -euo pipefail
APP=/usr/lib/github-desktop
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export ELECTRON_RUN_AS_NODE=1
node_run() { "$APP/github-desktop" "$HERE/check-keytar.js" "$APP/resources/app/keytar.node" "$@"; }

case "${1:-}" in
with-keyring)
  exec dbus-run-session -- bash -c '
    echo -n "test-keyring-pass" | gnome-keyring-daemon --unlock --components=secrets >/dev/null
    "'"$APP"'/github-desktop" "'"$HERE"'/check-keytar.js" "'"$APP"'/resources/app/keytar.node" roundtrip'
  ;;
no-keyring)
  unset DBUS_SESSION_BUS_ADDRESS XDG_RUNTIME_DIR || true
  node_run report
  ;;
 no-unlocked-keyring)
  # session bus present; gnome-keyring is D-Bus-activated but has no unlocked login collection
  exec dbus-run-session -- "$APP/github-desktop" "$HERE/check-keytar.js" "$APP/resources/app/keytar.node" report
  ;;
*) echo "usage: $0 with-keyring|no-keyring|no-unlocked-keyring" >&2; exit 2 ;;
esac
