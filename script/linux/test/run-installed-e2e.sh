#!/usr/bin/env bash
# Install the built .deb into a clean ubuntu:24.04 image, then run the Playwright E2E
# specs against the installed binary (/usr/bin/github-desktop) as a non-root user.
# Usage: script/linux/test/run-installed-e2e.sh [playwright args...]
# Requires dist/GitHubDesktop-linux-amd64-*.deb (yarn run package) and the gd-linux volumes
# (created by script/linux/run.sh), with node_modules installed in them.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
BUILDER=gd-linux-builder
IMAGE=gd-linux-installed-e2e

deb=$(ls "$REPO"/dist/GitHubDesktop-linux-amd64-*.deb | head -n 1)
ctx=$(mktemp -d)
trap 'rm -rf "$ctx"' EXIT
cp "$deb" "$ctx/"
cp "$REPO/script/linux/test/Dockerfile.installed" "$ctx/Dockerfile"

docker buildx inspect "$BUILDER" >/dev/null 2>&1 ||
  docker buildx create --name "$BUILDER" --driver docker-container --platform linux/amd64 >/dev/null
docker buildx build --builder "$BUILDER" --platform linux/amd64 --load \
  --label project=gd-linux --target e2e -t "$IMAGE" "$ctx"

docker run --rm --init --platform linux/amd64 -u tester --label project=gd-linux \
  -v "$REPO/script/linux/test/check-installed-exe.sh":/check.sh:ro "$IMAGE" /check.sh

exec docker run --rm --init --platform linux/amd64 -u tester --label project=gd-linux \
  -v "$REPO":/work \
  -v gd-linux-node_modules:/work/node_modules \
  -v gd-linux-app-node_modules:/work/app/node_modules \
  -v gd-linux-out:/work/out \
  -e DESKTOP_E2E_APP_PATH=/usr/bin/github-desktop \
  -w /work "$IMAGE" \
  xvfb-run -a node_modules/.bin/playwright test --config app/test/e2e/playwright.config.ts "$@"
