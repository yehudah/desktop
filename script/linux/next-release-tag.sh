#!/usr/bin/env bash
# Prints the next Linux release tag for HEAD: release-<upstream version>-linux<N>.
# N starts at 1 for each upstream version and increases for Linux-only releases.
# Prints nothing if HEAD already carries a Linux release tag.
#
# Usage: script/linux/next-release-tag.sh [expected-upstream-version]
# The upstream version is app/package.json's version at HEAD. With an argument
# (e.g. from an upstream-sync/release-X.Y.Z branch), the two must match.
set -euo pipefail

version=$(node -p "require('./app/package.json').version")
if ! [[ $version =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "app/package.json version '$version' is not a stable X.Y.Z release" >&2
  exit 1
fi
if [[ -n ${1:-} && $1 != "$version" ]]; then
  echo "Expected upstream version $1 but app/package.json has $version" >&2
  exit 1
fi

if git tag --points-at HEAD | grep -q -- '^release-.*-linux[0-9]*$'; then
  exit 0
fi

last=$(git tag --list "release-$version-linux*" |
  sed -n "s/^release-$version-linux\([0-9][0-9]*\)$/\1/p" | sort -n | tail -1)
echo "release-$version-linux$((${last:-0} + 1))"
