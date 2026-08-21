#!/usr/bin/env bash
# Downloads the ffmpeg sidecar binary for one or all supported targets into
# this directory, named by target triple as Tauri's externalBin expects.
#
# Usage:
#   ./fetch-ffmpeg.sh          # fetch for the current machine only
#   ./fetch-ffmpeg.sh --all    # fetch for all supported targets (e.g. in CI)
#
# Binaries come from the ffmpeg-static project's static builds (GPL-licensed).
# To swap in a smaller custom build, drop a binary with the same
# ffmpeg-<target-triple> name into this directory instead.
set -euo pipefail

cd "$(dirname "$0")"

RELEASE_BASE="https://github.com/eugeneware/ffmpeg-static/releases/download/b6.0"

fetch() {
  local triple="$1" asset="$2" ext="${3:-}"
  local out="ffmpeg-${triple}${ext}"
  if [[ -f "$out" ]]; then
    echo "already present: $out"
    return
  fi
  echo "downloading $asset -> $out"
  curl -fL --progress-bar -o "$out" "${RELEASE_BASE}/${asset}"
  chmod +x "$out"
}

if [[ "${1:-}" == "--all" ]]; then
  fetch aarch64-apple-darwin ffmpeg-darwin-arm64
  fetch x86_64-apple-darwin ffmpeg-darwin-x64
  fetch x86_64-pc-windows-msvc ffmpeg-win32-x64 .exe
else
  host="$(rustc -Vv | awk '/^host:/ {print $2}')"
  case "$host" in
    aarch64-apple-darwin) fetch aarch64-apple-darwin ffmpeg-darwin-arm64 ;;
    x86_64-apple-darwin) fetch x86_64-apple-darwin ffmpeg-darwin-x64 ;;
    x86_64-pc-windows-*) fetch "$host" ffmpeg-win32-x64 .exe ;;
    *) echo "unsupported host: $host (use --all or add a mapping)" >&2; exit 1 ;;
  esac
fi
