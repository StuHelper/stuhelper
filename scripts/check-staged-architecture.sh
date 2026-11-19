#!/usr/bin/env bash
# The hook reads this script from the index and runs it with Bash.
set -euo pipefail
root=$(git rev-parse --show-toplevel)
tree=$(git write-tree)
mapfile -t local_git_vars < <(git rev-parse --local-env-vars)
unset "${local_git_vars[@]}"
temporary=$(mktemp -d)
trap 'rm -rf -- "$temporary"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

git clone --quiet --shared --local --no-checkout -- "$root" "$temporary/source"
cd "$temporary/source"
git read-tree --reset -u "$tree"
if [[ -d "$root/node_modules" && ! -e node_modules && ! -L node_modules ]]; then
  ln -s -- "$root/node_modules" node_modules
fi
node scripts/architecture.mjs
node scripts/workspace.mjs validate
node --test scripts/*.test.mjs
