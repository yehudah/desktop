#!/usr/bin/env bash
# Extract the built AppImage (--appimage-extract, no FUSE) in a clean image (BASE_IMAGE, default ubuntu:24.04) that has
# only test tooling, then run the Playwright E2E specs against the extracted payload's binary as a non-root user.
# Usage: [BASE_IMAGE=debian:12] script/linux/test/run-appimage-e2e.sh [playwright args...]
# Requires dist/GitHubDesktop-linux-x86_64-*.AppImage (yarn run package) and the gd-linux volumes
# (created by script/linux/run.sh), with node_modules installed in them.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
BUILDER=gd-linux-builder
BASE_IMAGE=${BASE_IMAGE:-ubuntu:24.04}
IMAGE=gd-linux-appimage-e2e-$(echo "$BASE_IMAGE" | tr ':/' '--')

appimage=$(ls "$REPO"/dist/GitHubDesktop-linux-x86_64-*.AppImage | head -n 1)
ctx=$(mktemp -d)
trap 'rm -rf "$ctx"' EXIT
cp "$REPO/script/linux/test/Dockerfile.appimage" "$ctx/Dockerfile"

docker buildx inspect "$BUILDER" >/dev/null 2>&1 ||
  docker buildx create --name "$BUILDER" --driver docker-container --platform linux/amd64 >/dev/null
docker buildx build --builder "$BUILDER" --platform linux/amd64 --load \
  --label project=gd-linux --build-arg BASE_IMAGE="$BASE_IMAGE" -t "$IMAGE" "$ctx"

# The extracted payload is the app under test; the binary is squashfs-root/<executable> (AppRun just execs it).
exec docker run --rm --init --platform linux/amd64 -u tester --label project=gd-linux \
  -v "$REPO":/work \
  -v "$appimage":/in/app.AppImage:ro \
  -v gd-linux-node_modules:/work/node_modules \
  -v gd-linux-app-node_modules:/work/app/node_modules \
  -v gd-linux-out:/work/out \
  -w /work "$IMAGE" bash -euc '
    mkdir -p /tmp/ai && cp /in/app.AppImage /tmp/ai/app.AppImage && chmod +x /tmp/ai/app.AppImage
    (cd /tmp/ai && ./app.AppImage --appimage-extract >/dev/null)
    ls /tmp/ai/squashfs-root | head -30
    bin=/tmp/ai/squashfs-root/github-desktop
    test -x "$bin"
    export DESKTOP_E2E_APP_PATH="$bin"
    xvfb-run -a node_modules/.bin/playwright test --config app/test/e2e/playwright.config.ts "$@"
  ' _ "$@"
