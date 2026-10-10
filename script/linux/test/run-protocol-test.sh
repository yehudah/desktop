#!/usr/bin/env bash
# Protocol-handler E2E on the installed .deb (T14): builds the installed-e2e image for BASE_IMAGE
# (default ubuntu:24.04), then in one isolated container: prepares a pre-existing user default handler,
# reinstalls the .deb as root, and runs check-protocol-handler.sh as the non-root `tester` under xvfb.
# Usage: [BASE_IMAGE=debian:12] script/linux/test/run-protocol-test.sh
# seccomp=unconfined lets the app start sandboxed in Docker (see T13); not a package requirement.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
BUILDER=gd-linux-builder
BASE_IMAGE=${BASE_IMAGE:-ubuntu:24.04}
IMAGE=gd-linux-installed-e2e-$(echo "$BASE_IMAGE" | tr ':/' '--')

deb=$(ls "$REPO"/dist/GitHubDesktop-linux-amd64-*.deb | head -n 1)
ctx=$(mktemp -d)
name=gd-linux-protocol-$$
cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; rm -rf "$ctx"; }
trap cleanup EXIT
cp "$deb" "$ctx/"
cp "$REPO/script/linux/test/Dockerfile.installed" "$ctx/Dockerfile"

docker buildx inspect "$BUILDER" >/dev/null 2>&1 ||
  docker buildx create --name "$BUILDER" --driver docker-container --platform linux/amd64 >/dev/null
docker buildx build --builder "$BUILDER" --platform linux/amd64 --load \
  --label project=gd-linux --build-arg BASE_IMAGE="$BASE_IMAGE" --target e2e -t "$IMAGE" "$ctx"

docker run -d --init --platform linux/amd64 --label project=gd-linux --name "$name" \
  --security-opt seccomp=unconfined -u root \
  -v "$deb":/pkg/app.deb:ro \
  -v "$REPO/script/linux/test/check-protocol-handler.sh":/check.sh:ro \
  "$IMAGE" sleep 600 >/dev/null

docker exec -u tester "$name" /check.sh prepare
docker exec -u root "$name" bash -c 'dpkg -i /pkg/app.deb >/dev/null && echo "reinstalled: $(dpkg-query -W github-desktop)"'
docker exec -u tester "$name" xvfb-run -a /check.sh check
