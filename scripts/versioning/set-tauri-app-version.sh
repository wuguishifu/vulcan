#!/bin/bash

set -e

if [ $# -lt 2 ]; then
  echo "Usage: $0 <app_name> <version>"
  echo "Example: $0 vulcan 1.0.0"
  exit 1
fi

APP_NAME=$1
VERSION=$2

TAURI_DIR="apps/$APP_NAME/src-tauri"
CARGO_TOML="$TAURI_DIR/Cargo.toml"
TAURI_CONF="$TAURI_DIR/tauri.conf.json"

if [ ! -f "$CARGO_TOML" ]; then
  echo "❌ Error: $CARGO_TOML not found."
  exit 1
fi

if [ ! -f "$TAURI_CONF" ]; then
  echo "❌ Error: $TAURI_CONF not found."
  exit 1
fi

echo "🔧 Updating $APP_NAME to version $VERSION"

replace_in_file() {
  local pattern="$1"
  local replacement="$2"
  local file="$3"

  tmpfile="$(mktemp)"
  sed "s/${pattern}/${replacement}/" "$file" > "$tmpfile"
  mv "$tmpfile" "$file"
}

replace_in_file \
  '^version = ".*"' \
  "version = \"$VERSION\"" \
  "$CARGO_TOML"

replace_in_file \
  '\"version\": \"[^\"]*\"' \
  "\"version\": \"$VERSION\"" \
  "$TAURI_CONF"

echo "✅ Files updated:"
echo "   - $CARGO_TOML"
echo "   - $TAURI_CONF"
