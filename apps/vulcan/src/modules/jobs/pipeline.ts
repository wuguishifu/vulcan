import { join } from '@tauri-apps/api/path';

import {
  claudeSendMessage,
  parseClipResult,
  systemPrompt,
  userPrompt,
} from '@/modules/claude';
import {
  jobAdded,
  jobRemoved,
  jobUpdated,
  selectJobById,
  setIsProcessing,
  type Job,
  type TranscriptEntry,
} from '@/modules/session/session-slice';
import type { AppDispatch, RootState } from '@/modules/store/store';
import type { WhisperModelName } from '@/modules/whisper';

import { cleanupJob, createJobDir, readJobText, trashReplace } from './job-fs';
import {
  checkCancelled,
  clearCancelled,
  isCancelled,
  killLiveProcess,
  markCancelled,
  runFfmpegJob,
  runWhisperJob,
  tailLogs,
} from './process';
import { probeAudioTrackCount } from './probe';
import { mergeTranscripts, parseWhisperJson } from './transcript';

type AppThunk<R = void> = (
  dispatch: AppDispatch,
  getState: () => RootState,
) => Promise<R>;

const CLAUDE_MAX_TOKENS = 16000;

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

function fileExtension(path: string): string {
  const base = path.split(/[/\\]/).pop() ?? '';
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : 'mp4';
}

export interface StartJobInput {
  videoPath: string;
  whisperModel: WhisperModelName;
  claudeModel: string;
}

/**
 * Creates a job and kicks off the pipeline; resolves with the job id right
 * away so callers can track progress via the store. runPipeline never
 * rejects — failures land on the job as stage 'failed'.
 */
export function startJob(input: StartJobInput): AppThunk<string> {
  return async (dispatch) => {
    const job: Job = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      stage: 'extracting-audio',
      videoPath: input.videoPath,
      extension: fileExtension(input.videoPath),
      whisperModel: input.whisperModel,
      claudeModel: input.claudeModel,
      dir: null,
      audioTrackCount: null,
      transcript: null,
      claude: null,
      trim: null,
      trimmedPath: null,
      error: null,
    };
    dispatch(jobAdded(job));
    void dispatch(runPipeline(job.id));
    return job.id;
  };
}

/**
 * Re-runs the pipeline from transcription (the user rejected the result).
 * Extracted audio is reused when the extraction stage previously finished.
 */
export function retryJob(id: string): AppThunk {
  return async (dispatch) => {
    dispatch(
      jobUpdated({
        id,
        changes: {
          transcript: null,
          claude: null,
          trim: null,
          trimmedPath: null,
          error: null,
        },
      }),
    );
    await dispatch(runPipeline(id));
  };
}

function runPipeline(id: string): AppThunk {
  return async (dispatch, getState) => {
    clearCancelled(id);
    dispatch(setIsProcessing(true));
    try {
      const job = () => {
        const found = selectJobById(getState(), id);
        if (!found) throw new Error('cancelled');
        return found;
      };
      const { videoPath, whisperModel, claudeModel } = job();

      let dir = job().dir;
      if (!dir) {
        dir = await createJobDir(id);
        dispatch(jobUpdated({ id, changes: { dir } }));
      }

      // audioTrackCount is only recorded once every track's wav exists, so a
      // retry after a mid-extraction failure re-extracts from scratch.
      let trackCount = job().audioTrackCount;
      if (trackCount === null) {
        dispatch(jobUpdated({ id, changes: { stage: 'extracting-audio' } }));
        trackCount = await probeAudioTrackCount(id, videoPath);
        checkCancelled(id);
        for (let i = 0; i < trackCount; i++) {
          const wav = await join(dir, `audio-${i}.wav`);
          const result = await runFfmpegJob(id, [
            '-i',
            videoPath,
            '-map',
            `0:a:${i}`,
            '-ar',
            '16000',
            '-ac',
            '1',
            '-y',
            wav,
          ]);
          if (!result.success) {
            throw new Error(
              `audio extraction failed for track ${i + 1}: ${tailLogs(result.logs)}`,
            );
          }
          checkCancelled(id);
        }
        dispatch(jobUpdated({ id, changes: { audioTrackCount: trackCount } }));
      }

      dispatch(jobUpdated({ id, changes: { stage: 'transcribing' } }));
      const tracks: TranscriptEntry[][] = [];
      for (let i = 0; i < trackCount; i++) {
        const wav = await join(dir, `audio-${i}.wav`);
        const outputBase = await join(dir, `transcript-${i}`);
        const result = await runWhisperJob(id, whisperModel, [
          '-f',
          wav,
          '-oj',
          '-of',
          outputBase,
        ]);
        if (!result.success) {
          throw new Error(
            `transcription failed for track ${i + 1}: ${tailLogs(result.logs)}`,
          );
        }
        checkCancelled(id);
        const raw = await readJobText(id, `transcript-${i}.json`);
        tracks.push(parseWhisperJson(raw, i === 0 ? 'host' : 'others'));
      }
      const transcript = mergeTranscripts(tracks);
      if (transcript.length === 0) {
        throw new Error('transcript is empty — no speech detected');
      }
      dispatch(jobUpdated({ id, changes: { transcript } }));

      dispatch(jobUpdated({ id, changes: { stage: 'analyzing' } }));
      const response = await claudeSendMessage({
        model: claudeModel,
        system: systemPrompt,
        userMessage: userPrompt(JSON.stringify(transcript, null, 2)),
        maxTokens: CLAUDE_MAX_TOKENS,
      });
      checkCancelled(id);
      const clip = parseClipResult(response);
      dispatch(jobUpdated({ id, changes: { claude: clip } }));
      if (!clip.found) {
        dispatch(jobUpdated({ id, changes: { stage: 'no-clip-found' } }));
        return;
      }

      await dispatch(trimStep(id, clip.start_seconds, clip.end_seconds));
    } catch (error) {
      if (isCancelled(id)) return;
      dispatch(
        jobUpdated({
          id,
          changes: { stage: 'failed', error: errorMessage(error) },
        }),
      );
    } finally {
      dispatch(setIsProcessing(false));
    }
  };
}

/**
 * Stream-copy trim. Input-side `-ss` with `-c copy` seeks to the nearest
 * keyframe at or before `start` and cannot drop the frames in between, so
 * the clip never starts inside the target segment — a slightly early start
 * is the accepted tradeoff for a lossless, near-instant cut.
 */
function trimStep(id: string, start: number, end: number): AppThunk {
  return async (dispatch, getState) => {
    const job = selectJobById(getState(), id);
    if (!job?.dir) throw new Error('job has no working directory');
    const attempt = (job.trim?.attempt ?? 0) + 1;
    dispatch(jobUpdated({ id, changes: { stage: 'trimming' } }));
    const output = await join(job.dir, `trimmed-${attempt}.${job.extension}`);
    const result = await runFfmpegJob(id, [
      '-ss',
      String(start),
      '-i',
      job.videoPath,
      '-t',
      String(end - start),
      '-map',
      '0',
      '-c',
      'copy',
      '-avoid_negative_ts',
      'make_zero',
      '-y',
      output,
    ]);
    if (!result.success) {
      throw new Error(`trimming failed: ${tailLogs(result.logs)}`);
    }
    dispatch(
      jobUpdated({
        id,
        changes: {
          trim: { start, end, attempt },
          trimmedPath: output,
          stage: 'awaiting-review',
          error: null,
        },
      }),
    );
  };
}

/** Re-trims with user-edited timestamps from the review screen. */
export function retrimJob(id: string, start: number, end: number): AppThunk {
  return async (dispatch) => {
    dispatch(setIsProcessing(true));
    try {
      await dispatch(trimStep(id, start, end));
    } catch (error) {
      if (isCancelled(id)) return;
      dispatch(
        jobUpdated({
          id,
          changes: { stage: 'failed', error: errorMessage(error) },
        }),
      );
    } finally {
      dispatch(setIsProcessing(false));
    }
  };
}

/**
 * Accepts the trimmed clip: the original goes to the OS recycle bin and the
 * clip takes its path. On failure the job stays reviewable with the error
 * set (the original is recoverable from the recycle bin if it was moved).
 */
export function confirmJob(id: string): AppThunk<boolean> {
  return async (dispatch, getState) => {
    const job = selectJobById(getState(), id);
    if (!job?.trimmedPath) return false;
    try {
      await trashReplace(job.videoPath, job.trimmedPath);
      await cleanupJob(id);
      dispatch(
        jobUpdated({
          id,
          changes: { stage: 'done', dir: null, trimmedPath: null, error: null },
        }),
      );
      return true;
    } catch (error) {
      dispatch(jobUpdated({ id, changes: { error: errorMessage(error) } }));
      return false;
    }
  };
}

/** Abandons the job: kills any running process and removes its files. */
export function cancelJob(id: string): AppThunk {
  return async (dispatch) => {
    markCancelled(id);
    await killLiveProcess(id);
    dispatch(jobRemoved(id));
    dispatch(setIsProcessing(false));
    try {
      await cleanupJob(id);
    } catch {
      // job dir removal is best-effort; orphans are harmless
    }
  };
}

/** Drops a finished/failed job from the list without touching any files. */
export function dismissJob(id: string): AppThunk {
  return async (dispatch, getState) => {
    const job = selectJobById(getState(), id);
    if (!job) return;
    dispatch(jobRemoved(id));
    try {
      await cleanupJob(id);
    } catch {
      // best-effort cleanup
    }
  };
}
