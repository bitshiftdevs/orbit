#!/usr/bin/env bash
# Cut a new release of the Orbit GitHub Action.
# Usage: scripts/release-action.sh <version>   e.g. scripts/release-action.sh v1.1.0
#
# Pushes an immutable semver tag; a GitHub Actions workflow
# (.github/workflows/release-action.yml) then force-moves the matching major
# tag (v1) so consumers pinned to @v1 pick it up automatically.

set -euo pipefail

if [ $# -ne 1 ]; then
  echo "usage: $0 <version>   (e.g. v1.1.0)" >&2
  exit 1
fi

version="$1"
if ! [[ "$version" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "version must look like vMAJOR.MINOR.PATCH (got: $version)" >&2
  exit 1
fi

if ! git diff-index --quiet HEAD --; then
  echo "working tree is dirty — commit or stash first" >&2
  exit 1
fi

if git rev-parse -q --verify "refs/tags/$version" >/dev/null; then
  echo "tag $version already exists" >&2
  exit 1
fi

echo "Tagging $(git rev-parse --short HEAD) as $version"
git tag -a "$version" -m "Release $version"
git push origin "$version"

echo "Pushed $version — the release-action workflow will move ${version%%.*} shortly."
