import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export interface FfmpegLog {
  id: number;
  stream: 'stdout' | 'stderr' | 'error';
  line: string;
}

export interface FfmpegExit {
  id: number;
  code: number | null;
  success: boolean;
}

/** Spawns the bundled ffmpeg with the given args; resolves to a job id. */
export function runFfmpeg(args: string[]): Promise<number> {
  return invoke('ffmpeg_run', { args });
}

export function killFfmpeg(id: number): Promise<void> {
  return invoke('ffmpeg_kill', { id });
}

/** Ids of jobs still running. */
export function listFfmpegJobs(): Promise<number[]> {
  return invoke('ffmpeg_running');
}

/** ffmpeg writes all progress/diagnostics to stderr. */
export function onFfmpegLog(
  handler: (log: FfmpegLog) => void,
): Promise<UnlistenFn> {
  return listen<FfmpegLog>('ffmpeg:log', (event) => handler(event.payload));
}

export function onFfmpegExit(
  handler: (exit: FfmpegExit) => void,
): Promise<UnlistenFn> {
  return listen<FfmpegExit>('ffmpeg:exit', (event) => handler(event.payload));
}
