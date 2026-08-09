#!/bin/sh
set -eu

repo_root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
hooks_path="$repo_root/.githooks"

chmod +x "$hooks_path/pre-commit" "$hooks_path/post-commit"
git config --local core.hooksPath "$hooks_path"

printf 'Configured core.hooksPath -> %s\n' "$hooks_path"
