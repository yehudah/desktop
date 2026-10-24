#!/usr/bin/env bash
# Check the .deb's sandbox setup (chrome-sandbox SUID, AppArmor userns profile) on each
# supported distro. Usage: script/linux/test/run-deb-sandbox-test.sh [base-image...]
# Requires dist/GitHubDesktop-linux-amd64-*.deb (yarn run package).
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
[[ $# -gt 0 ]] || set -- ubuntu:24.04 ubuntu:22.04 debian:12

status=0
for base in "$@"; do
  echo "== $base"
  docker run --rm --platform linux/amd64 --label project=gd-linux \
    -v "$REPO/dist":/deb:ro \
    -v "$REPO/script/linux/test/check-deb-sandbox.sh":/check.sh:ro \
    "$base" /check.sh || status=1
done
exit $status
