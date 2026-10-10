#!/usr/bin/env bash
# Credential-storage check on the installed .deb (T15): in a clean container, runs the installed app's
# bundled keytar.node (ELECTRON_RUN_AS_NODE=1) against an unlocked gnome-keyring under dbus-run-session,
# then with no Secret Service. Reuses the Dockerfile.installed e2e image; gnome-keyring is added at run time.
# Usage: [BASE_IMAGE=debian:12] script/linux/test/run-keytar-test.sh
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
BUILDER=gd-linux-builder
BASE_IMAGE=${BASE_IMAGE:-ubuntu:24.04}
IMAGE=gd-linux-installed-e2e-$(echo "$BASE_IMAGE" | tr ':/' '--')

deb=$(ls "$REPO"/dist/GitHubDesktop-linux-amd64-*.deb | head -n 1)
ctx=$(mktemp -d)
name=gd-linux-keytar-$$
cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; rm -rf "$ctx"; }
trap cleanup EXIT
cp "$deb" "$ctx/"
cp "$REPO/script/linux/test/Dockerfile.installed" "$ctx/Dockerfile"

docker buildx inspect "$BUILDER" >/dev/null 2>&1 ||
  docker buildx create --name "$BUILDER" --driver docker-container --platform linux/amd64 >/dev/null
docker buildx build --builder "$BUILDER" --platform linux/amd64 --load \
  --label project=gd-linux --build-arg BASE_IMAGE="$BASE_IMAGE" --target e2e -t "$IMAGE" "$ctx"

docker run -d --init --platform linux/amd64 --label project=gd-linux --name "$name" -u root \
  -v "$REPO/script/linux/test":/t:ro "$IMAGE" sleep 600 >/dev/null

# The no-keyring run goes first so it cannot be satisfied by a leftover daemon.
docker exec -u root "$name" bash -c \
  'dpkg -s gnome-keyring >/dev/null 2>&1 || (apt-get update -qq && apt-get install -y -qq --no-install-recommends gnome-keyring dbus-user-session >/dev/null)'
echo "=== no Secret Service ==="
docker exec -u tester "$name" /t/check-keytar.sh no-keyring
echo "=== session bus, keyring auto-activated but never unlocked ==="
docker exec -u tester "$name" /t/check-keytar.sh no-unlocked-keyring
echo "=== gnome-keyring (unlocked) ==="
docker exec -u tester "$name" /t/check-keytar.sh with-keyring
