# ffmpeg sidecar binaries

Tauri bundles the file whose target-triple suffix matches the build target
(`binaries/ffmpeg` in `tauri.conf.json` → `ffmpeg-<target-triple>[.exe]` here)
and ships it as plain `ffmpeg` next to the app binary. The binaries are
gitignored; run `./fetch-ffmpeg.sh` after cloning (or `--all` in CI/release
builds that target multiple platforms).

Expected files:

- `ffmpeg-aarch64-apple-darwin` — macOS Apple Silicon
- `ffmpeg-x86_64-apple-darwin` — macOS Intel
- `ffmpeg-x86_64-pc-windows-msvc.exe` — Windows x64

The fetch script pulls full static GPL builds from the ffmpeg-static project.
Since we only slice/stitch audio and video, a much smaller custom build
(`./configure --disable-everything` plus the needed demuxers/muxers/codecs)
can replace them later — just keep the same filenames; nothing else changes.
Note the GPL builds make the bundled app distribution subject to the GPL;
use LGPL-configured builds if that matters.
