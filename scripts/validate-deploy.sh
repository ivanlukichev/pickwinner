#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_DIR="$ROOT_DIR/deploy"
HTML_FILES=()

if [[ ! -d "$DEPLOY_DIR" ]]; then
  echo "Missing deploy directory: $DEPLOY_DIR" >&2
  exit 1
fi

while IFS= read -r -d '' file; do
  HTML_FILES+=("$file")
done < <(find "$DEPLOY_DIR" -type f -name '*.html' -print0 | sort -z)

if [[ ${#HTML_FILES[@]} -eq 0 ]]; then
  echo "No HTML files found in $DEPLOY_DIR" >&2
  exit 1
fi

if find "$DEPLOY_DIR" -type f \
  \( -name '*.md' -o -name '*.zip' -o -name '*.tar' -o -name '*.psd' -o -name '*.fig' -o -name '.env*' -o -name '*.log' -o -iname '*backup*' -o -iname '*copy*' -o -iname '*old*' \) \
  | grep -q .; then
  echo "Forbidden non-production files found in deploy/" >&2
  find "$DEPLOY_DIR" -type f \
    \( -name '*.md' -o -name '*.zip' -o -name '*.tar' -o -name '*.psd' -o -name '*.fig' -o -name '.env*' -o -name '*.log' -o -iname '*backup*' -o -iname '*copy*' -o -iname '*old*' \)
  exit 1
fi

if ! grep -q '"directory": "deploy"' "$ROOT_DIR/wrangler.jsonc"; then
  echo "wrangler.jsonc is not targeting deploy/" >&2
  exit 1
fi

if [[ ! -f "$DEPLOY_DIR/robots.txt" ]]; then
  echo "Missing deploy/robots.txt" >&2
  exit 1
fi

if [[ ! -f "$DEPLOY_DIR/sitemap.xml" ]]; then
  echo "Missing deploy/sitemap.xml" >&2
  exit 1
fi

for file in "${HTML_FILES[@]}"; do
  if ! rg -q '<title>.+</title>' "$file"; then
    echo "Missing title tag: $file" >&2
    exit 1
  fi

  if ! rg -q 'meta name="description"' "$file"; then
    echo "Missing meta description: $file" >&2
    exit 1
  fi

  if ! rg -q 'rel="canonical"' "$file"; then
    echo "Missing canonical link: $file" >&2
    exit 1
  fi

  h1_count="$(rg -o '<h1\b' "$file" | wc -l | tr -d ' ')"
  if [[ "$h1_count" != "1" ]]; then
    echo "Expected exactly one h1 in $file, found $h1_count" >&2
    exit 1
  fi

  if rg -qi 'TODO|FIXME|fix later|codex|debug' "$file"; then
    echo "Found developer note text in $file" >&2
    exit 1
  fi
done

echo "deploy validation passed"
