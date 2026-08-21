import { runFfmpegJob } from './process';

/**
 * Counts the audio tracks in a media file by parsing `ffmpeg -i` stderr
 * (there is no bundled ffprobe). ffmpeg exits non-zero because no output
 * file is given — that's expected; only the stream listing matters. The
 * pipeline maps tracks audio-relatively (`-map 0:a:<i>`), so the count is
 * all it needs.
 */
export async function probeAudioTrackCount(
  jobId: string,
  videoPath: string,
): Promise<number> {
  const { logs } = await runFfmpegJob(jobId, ['-hide_banner', '-i', videoPath]);
  const count = logs.filter((line) =>
    /Stream #\d+:\d+.*?: Audio:/.test(line),
  ).length;
  if (count === 0) {
    throw new Error(
      'no audio tracks found — is this a valid video file with sound?',
    );
  }
  return count;
}
