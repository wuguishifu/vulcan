import type { UnlistenFn } from '@tauri-apps/api/event';

import {
  killFfmpeg,
  onFfmpegExit,
  onFfmpegLog,
  runFfmpeg,
} from '@/modules/ffmpeg';
import {
  killWhisper,
  onWhisperExit,
  onWhisperLog,
  runWhisper,
  type WhisperModelName,
} from '@/modules/whisper';

export interface ProcessResult {
  code: number | null;
  success: boolean;
  logs: string[];
}

// The process currently running for each pipeline job, so cancel can kill it.
const liveProcesses = new Map<
  string,
  { kind: 'ffmpeg' | 'whisper'; pid: number }
>();

// Jobs the user cancelled; the pipeline bails out at each stage boundary.
const cancelledJobs = new Set<string>();

export function markCancelled(jobId: string) {
  cancelledJobs.add(jobId);
}

export function clearCancelled(jobId: string) {
  cancelledJobs.delete(jobId);
}

export function isCancelled(jobId: string): boolean {
  return cancelledJobs.has(jobId);
}

/** Throws if the job was cancelled; call at every stage boundary. */
export function checkCancelled(jobId: string) {
  if (cancelledJobs.has(jobId)) throw new Error('cancelled');
}

export async function killLiveProcess(jobId: string): Promise<void> {
  const live = liveProcesses.get(jobId);
  if (!live) return;
  if (live.kind === 'ffmpeg') await killFfmpeg(live.pid);
  else await killWhisper(live.pid);
}

interface ProcessEvents {
  log: { id: number; line: string };
  exit: { id: number; code: number | null; success: boolean };
}

/**
 * Runs a sidecar process to completion, collecting its log lines. Listeners
 * are registered and events buffered BEFORE spawning: the pid is only known
 * once the invoke resolves, and a fast process can exit before that.
 */
async function runProcess(
  jobId: string,
  kind: 'ffmpeg' | 'whisper',
  spawn: () => Promise<number>,
  listenLog: (
    handler: (log: ProcessEvents['log']) => void,
  ) => Promise<UnlistenFn>,
  listenExit: (
    handler: (exit: ProcessEvents['exit']) => void,
  ) => Promise<UnlistenFn>,
): Promise<ProcessResult> {
  const logs: string[] = [];
  const pendingLogs: ProcessEvents['log'][] = [];
  const pendingExits: ProcessEvents['exit'][] = [];
  let pid: number | null = null;
  let resolveExit: (exit: ProcessEvents['exit']) => void;
  const exitPromise = new Promise<ProcessEvents['exit']>((resolve) => {
    resolveExit = resolve;
  });

  const unlistens = await Promise.all([
    listenLog((log) => {
      if (pid === null) pendingLogs.push(log);
      else if (log.id === pid) logs.push(log.line);
    }),
    listenExit((exit) => {
      if (pid === null) pendingExits.push(exit);
      else if (exit.id === pid) resolveExit(exit);
    }),
  ]);

  try {
    pid = await spawn();
    liveProcesses.set(jobId, { kind, pid });
    for (const log of pendingLogs) {
      if (log.id === pid) logs.push(log.line);
    }
    const earlyExit = pendingExits.find((exit) => exit.id === pid);
    const exit = earlyExit ?? (await exitPromise);
    return { code: exit.code, success: exit.success, logs };
  } finally {
    liveProcesses.delete(jobId);
    unlistens.forEach((unlisten) => unlisten());
  }
}

export function runFfmpegJob(
  jobId: string,
  args: string[],
): Promise<ProcessResult> {
  return runProcess(
    jobId,
    'ffmpeg',
    () => runFfmpeg(args),
    (handler) => onFfmpegLog(handler),
    (handler) => onFfmpegExit(handler),
  );
}

export function runWhisperJob(
  jobId: string,
  model: WhisperModelName,
  args: string[],
): Promise<ProcessResult> {
  return runProcess(
    jobId,
    'whisper',
    () => runWhisper(model, args),
    (handler) => onWhisperLog(handler),
    (handler) => onWhisperExit(handler),
  );
}

/** The last few log lines, for error messages. */
export function tailLogs(logs: string[], lines = 3): string {
  return logs
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-lines)
    .join(' | ');
}
