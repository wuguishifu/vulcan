import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

import type { WhisperModelName } from './models';

export interface WhisperLog {
  id: number;
  stream: 'stdout' | 'stderr' | 'error';
  line: string;
}

export interface WhisperExit {
  id: number;
  code: number | null;
  success: boolean;
}

/**
 * Spawns the bundled whisper-cli with a downloaded model; resolves to a job
 * id. The backend injects `-m <model path>`, so `args` is everything else,
 * e.g. `['-f', audioPath, '-oj', '-of', outputBase]`. whisper-cli reads
 * flac/mp3/ogg/wav directly; for anything else (mp4, mkv, m4a, ...) extract
 * the audio with the ffmpeg module first:
 * `runFfmpeg(['-i', input, '-ar', '16000', '-ac', '1', wavPath])`.
 */
export function runWhisper(
  model: WhisperModelName,
  args: string[],
): Promise<number> {
  return invoke('whisper_run', { model, args });
}

export function killWhisper(id: number): Promise<void> {
  return invoke('whisper_kill', { id });
}

/** Ids of jobs still running. */
export function listWhisperJobs(): Promise<number[]> {
  return invoke('whisper_running');
}

export function onWhisperLog(
  handler: (log: WhisperLog) => void,
): Promise<UnlistenFn> {
  return listen<WhisperLog>('whisper:log', (event) => handler(event.payload));
}

export function onWhisperExit(
  handler: (exit: WhisperExit) => void,
): Promise<UnlistenFn> {
  return listen<WhisperExit>('whisper:exit', (event) => handler(event.payload));
}
