#!/usr/bin/env bash
# Prints the next upstream release to sync into linux: the oldest stable
# release-X.Y.Z newer than the newest one linux already contains. Older releases
# that linux never merged are skipped. Prints nothing if linux is up to date.
#
# Usage: script/linux/next-upstream-release.sh <linux-ref>
# Upstream tags must already be fetched as refs/tags/upstream/release-*.
set -euo pipefail

stable() {
  sed 's|^upstream/||' |
    { grep -E '^release-[0-9]+\.[0-9]+\.[0-9]+$' || test "$?" -eq 1; } |
    sort -V
}

all=$(git tag --list 'upstream/release-*' | stable)
newest=$(git tag --list --merged "$1" 'upstream/release-*' | stable | tail -n 1)
if [[ -z $newest ]]; then
  echo "$1 contains no stable upstream release tag" >&2
  exit 1
fi
printf '%s\n' "$all" |
  awk -v newest="$newest" 'found { print; exit } $0 == newest { found = 1 }'
