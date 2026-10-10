#!/usr/bin/env bash
# Package lifecycle test (T17): install an older build of the .deb, upgrade to the current one,
# purge, reinstall, in a clean BASE_IMAGE (default ubuntu:24.04) as root. See check-package-lifecycle.sh.
# Usage: [BASE_IMAGE=debian:12] script/linux/test/run-lifecycle-test.sh
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
BASE_IMAGE=${BASE_IMAGE:-ubuntu:24.04}
deb=$(ls "$REPO"/dist/GitHubDesktop-linux-amd64-*.deb | head -n 1)

docker run --rm --init --platform linux/amd64 --label project=gd-linux -u root \
  -v "$deb":/deb/current.deb:ro \
  -v "$REPO/script/linux/test/check-package-lifecycle.sh":/check.sh:ro \
  "$BASE_IMAGE" bash /check.sh
