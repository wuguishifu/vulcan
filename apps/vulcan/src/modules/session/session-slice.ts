import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { ClaudeClipResult } from '@/modules/claude/claude';
import type { WhisperModelName } from '@/modules/whisper/models';

export type JobStage =
  | 'extracting-audio'
  | 'transcribing'
  | 'analyzing'
  | 'trimming'
  | 'awaiting-review'
  | 'done'
  | 'failed'
  | 'no-clip-found';

/** Stages during which a pipeline is actively running for the job. */
export const ACTIVE_STAGES: readonly JobStage[] = [
  'extracting-audio',
  'transcribing',
  'analyzing',
  'trimming',
];

export interface TranscriptEntry {
  speaker: 'host' | 'others';
  /** Seconds. */
  start: number;
  end: number;
  text: string;
}

export interface Job {
  id: string;
  createdAt: number;
  stage: JobStage;
  /** The original video the user picked. */
  videoPath: string;
  /** File extension of the original, without the dot. */
  extension: string;
  whisperModel: WhisperModelName;
  claudeModel: string;
  /** Working directory from job_create_dir. */
  dir: string | null;
  audioTrackCount: number | null;
  transcript: TranscriptEntry[] | null;
  claude: ClaudeClipResult | null;
  /** The currently applied trim range; attempt increments per re-trim. */
  trim: { start: number; end: number; attempt: number } | null;
  trimmedPath: string | null;
  /** Present when stage is 'failed'. */
  error: string | null;
}

export type SessionState = {
  isProcessing: boolean;
  jobs: Job[];
};

const initialState: SessionState = {
  isProcessing: false,
  jobs: [],
};

const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    setIsProcessing(state, action: PayloadAction<boolean>) {
      state.isProcessing = action.payload;
    },
    jobAdded(state, action: PayloadAction<Job>) {
      state.jobs.push(action.payload);
    },
    jobUpdated(
      state,
      action: PayloadAction<{ id: string; changes: Partial<Job> }>,
    ) {
      const job = state.jobs.find((j) => j.id === action.payload.id);
      if (job) Object.assign(job, action.payload.changes);
    },
    jobRemoved(state, action: PayloadAction<string>) {
      state.jobs = state.jobs.filter((j) => j.id !== action.payload);
    },
  },
});

export const { setIsProcessing, jobAdded, jobUpdated, jobRemoved } =
  sessionSlice.actions;
export const sessionReducer = sessionSlice.reducer;

export const selectJobById = (
  state: { session: SessionState },
  id: string | null,
): Job | undefined =>
  id === null ? undefined : state.session.jobs.find((job) => job.id === id);

/** The most recently created job, if any. */
export const selectActiveJob = (state: {
  session: SessionState;
}): Job | undefined => state.session.jobs.at(-1);
