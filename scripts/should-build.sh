#!/usr/bin/env bash
# Vercel ignoreCommand. Exit 0 to SKIP the build, exit 1 to BUILD.
#
# A push that only touches design assets or documentation cannot change what is
# served, so it should not burn a build or replace a working deployment.
set -euo pipefail

# No diff to inspect (first deploy, or a shallow clone without the parent):
# build, because skipping on missing information is the expensive mistake.
if [ -z "${VERCEL_GIT_PREVIOUS_SHA:-}" ] || ! git rev-parse --verify -q "${VERCEL_GIT_PREVIOUS_SHA}^{commit}" >/dev/null; then
  echo "No previous SHA to compare against — building."
  exit 1
fi

changed="$(git diff --name-only "${VERCEL_GIT_PREVIOUS_SHA}" HEAD)"

if [ -z "$changed" ]; then
  echo "No file changes — skipping."
  exit 0
fi

# Anything outside these paths means the build is real.
if echo "$changed" | grep -qvE '^(brand/|docs/|eval/|fixtures/|site/|[^/]*\.md$)'; then
  echo "Source changed — building."
  exit 1
fi

echo "Only design assets and docs changed — skipping the build."
exit 0
