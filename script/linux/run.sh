#!/usr/bin/env bash
# Run a command inside the gd-linux build container (repo bind-mounted at /work).
# Usage: script/linux/run.sh [--build] [--root] <command...>
# Headless display: run.sh xvfb-run -a <command...>  (--init makes tini PID 1 so Xvfb signalling works)
set -euo pipefail

IMAGE=gd-linux
BUILDER=gd-linux-builder
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VOLUMES=(gd-linux-node_modules gd-linux-app-node_modules gd-linux-packaging-node_modules
  gd-linux-electron-cache gd-linux-yarn-cache gd-linux-out)

build=0
user=builder
while [[ ${1:-} == --* ]]; do
  case "$1" in
    --build) build=1 ;;
    --root) user=root ;;
    *) break ;;
  esac
  shift
done

if [[ $build == 1 ]] || ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  docker buildx inspect "$BUILDER" >/dev/null 2>&1 ||
    docker buildx create --name "$BUILDER" --driver docker-container --platform linux/amd64 >/dev/null
  docker buildx build --builder "$BUILDER" --platform linux/amd64 --load \
    --label project=gd-linux -t "$IMAGE" "$REPO/script/linux"
fi

for v in "${VOLUMES[@]}"; do
  docker volume inspect "$v" >/dev/null 2>&1 || docker volume create --label project=gd-linux "$v" >/dev/null
done
# out/ is a volume too: on the macOS bind mount, files copied with Node's
# cpSync lose their mode (they end up 0200) and packaging fails.
# Fresh volumes are root-owned; hand them to the builder user.
docker run --rm --platform linux/amd64 -u root \
  -v gd-linux-node_modules:/v/nm -v gd-linux-app-node_modules:/v/anm \
  -v gd-linux-packaging-node_modules:/v/pnm \
  -v gd-linux-electron-cache:/v/ec -v gd-linux-yarn-cache:/v/yc \
  -v gd-linux-out:/v/out \
  "$IMAGE" chown builder:builder /v/nm /v/anm /v/pnm /v/ec /v/yc /v/out

tty=()
[[ -t 0 && -t 1 ]] && tty=(-it)

exec docker run --rm --init --platform linux/amd64 ${tty[@]+"${tty[@]}"} -u "$user" \
  --label project=gd-linux \
  -v "$REPO":/work \
  -v gd-linux-node_modules:/work/node_modules \
  -v gd-linux-app-node_modules:/work/app/node_modules \
  -v gd-linux-packaging-node_modules:/work/script/linux/node_modules \
  -v gd-linux-out:/work/out \
  -v gd-linux-electron-cache:/home/builder/.cache/electron \
  -v gd-linux-yarn-cache:/home/builder/.cache/yarn \
  -e YARN_CACHE_FOLDER=/home/builder/.cache/yarn \
  -w /work "$IMAGE" "$@"
