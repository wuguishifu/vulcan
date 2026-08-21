import type { TranscriptEntry } from '@/modules/session/session-slice';

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Parses whisper-cli's `-oj` JSON output for one audio track. The expected
 * shape is `{ transcription: [{ offsets: { from, to }, text }] }` with
 * offsets in milliseconds; unknown fields are ignored and segments without
 * usable offsets or text are skipped.
 */
export function parseWhisperJson(
  raw: string,
  speaker: TranscriptEntry['speaker'],
): TranscriptEntry[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('whisper output is not valid JSON');
  }
  const transcription = (parsed as { transcription?: unknown }).transcription;
  if (!Array.isArray(transcription)) {
    throw new Error('whisper output is missing "transcription"');
  }

  const entries: TranscriptEntry[] = [];
  for (const segment of transcription as Array<{
    offsets?: { from?: unknown; to?: unknown };
    text?: unknown;
  }>) {
    const from = segment?.offsets?.from;
    const to = segment?.offsets?.to;
    if (typeof from !== 'number' || typeof to !== 'number') continue;
    const text = typeof segment.text === 'string' ? segment.text.trim() : '';
    if (!text) continue;
    entries.push({
      speaker,
      start: round2(from / 1000),
      end: round2(to / 1000),
      text,
    });
  }
  return entries;
}

/** Interleaves per-track transcripts into one timeline, sorted by start. */
export function mergeTranscripts(
  tracks: TranscriptEntry[][],
): TranscriptEntry[] {
  return tracks.flat().sort((a, b) => a.start - b.start);
}
