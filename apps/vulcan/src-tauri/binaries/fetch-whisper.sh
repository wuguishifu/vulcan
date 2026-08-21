#!/usr/bin/env bash
# Builds the whisper-cli sidecar binary from whisper.cpp source for the host
# target and drops it into this directory, named by target triple as Tauri's
# externalBin expects.
#
# Usage:
#   ./fetch-whisper.sh    # build for the current machine
#
# Unlike ffmpeg there are no official single-file releases (macOS has no
# prebuilt binaries and the Windows zips are DLL-based), so this compiles a
# static build at a pinned tag. Requires cmake and a C/C++ toolchain, both
# preinstalled on GitHub runners. On macOS the Metal shader is embedded in
# the binary by default, so the single file is fully self-contained.
set -euo pipefail

cd "$(dirname "$0")"

WHISPER_VERSION="v1.9.3"

host="$(rustc -Vv | awk '/^host:/ {print $2}')"
case "$host" in
  aarch64-apple-darwin | x86_64-apple-darwin)
    out="whisper-cli-${host}"
    built="whisper-cli"
    ;;
  x86_64-pc-windows-*)
    out="whisper-cli-${host}.exe"
    built="whisper-cli.exe"
    ;;
  *) echo "unsupported host: $host (add a mapping)" >&2; exit 1 ;;
esac

if [[ -f "$out" ]]; then
  echo "already present: $out"
  exit 0
fi

workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT

echo "downloading whisper.cpp ${WHISPER_VERSION}"
curl -fL --progress-bar -o "$workdir/src.tar.gz" \
  "https://github.com/ggml-org/whisper.cpp/archive/refs/tags/${WHISPER_VERSION}.tar.gz"
tar -xzf "$workdir/src.tar.gz" -C "$workdir" --strip-components=1

echo "building whisper-cli (static)"
cmake -S "$workdir" -B "$workdir/build" \
  -DCMAKE_BUILD_TYPE=Release \
  -DBUILD_SHARED_LIBS=OFF \
  -DWHISPER_BUILD_TESTS=OFF
cmake --build "$workdir/build" --config Release -j --target whisper-cli

# single-config generators put the binary in bin/, MSVC in bin/Release/
for candidate in "$workdir/build/bin/$built" "$workdir/build/bin/Release/$built"; do
  if [[ -f "$candidate" ]]; then
    cp "$candidate" "$out"
    chmod +x "$out"
    echo "built: $out"
    exit 0
  fi
done

echo "build finished but $built was not found in the build tree" >&2
exit 1
