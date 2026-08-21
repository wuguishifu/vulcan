# sidecar binaries

Tauri bundles the file whose target-triple suffix matches the build target
(`binaries/<name>` in `tauri.conf.json` → `<name>-<target-triple>[.exe]` here)
and ships it as plain `<name>` next to the app binary. The binaries are
gitignored; run the fetch scripts after cloning.

Expected files:

- `ffmpeg-aarch64-apple-darwin` — macOS Apple Silicon
- `ffmpeg-x86_64-apple-darwin` — macOS Intel
- `ffmpeg-x86_64-pc-windows-msvc.exe` — Windows x64
- `whisper-cli-<host-triple>[.exe]` — same targets, host-built

## ffmpeg (`./fetch-ffmpeg.sh`, `--all` for every target)

Pulls full static GPL builds from the ffmpeg-static project. Since we only
slice/stitch audio and video, a much smaller custom build
(`./configure --disable-everything` plus the needed demuxers/muxers/codecs)
can replace them later — just keep the same filenames; nothing else changes.
Note the GPL builds make the bundled app distribution subject to the GPL;
use LGPL-configured builds if that matters.

## whisper-cli (`./fetch-whisper.sh`)

whisper.cpp publishes no macOS binaries and only DLL-based Windows zips, so
the script compiles a static `whisper-cli` from source at a pinned tag
(requires cmake + a C/C++ toolchain; a few minutes). It only builds for the
host, which is what each CI matrix runner needs. MIT-licensed.

Models are NOT bundled — the app downloads ggml models from Hugging Face
into the app data dir (`whisper-models/`) on demand via the `whisper`
frontend module, starting small with opt-in upgrades to larger models.
