import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export interface WhisperModelInfo {
  name: string;
  label: string;
  /** Approximate download size, for showing before the user opts in. */
  approxSizeMB: number;
  englishOnly: boolean;
  description: string;
}

/**
 * Models the backend knows how to download, smallest first. This list must
 * stay in sync with `MODELS` in src-tauri/src/whisper.rs.
 */
export const WHISPER_MODELS: readonly WhisperModelInfo[] = [
  {
    name: 'tiny',
    label: 'Tiny',
    approxSizeMB: 78,
    englishOnly: false,
    description: 'Fastest, least accurate. Good for quick drafts.',
  },
  {
    name: 'tiny.en',
    label: 'Tiny (English)',
    approxSizeMB: 78,
    englishOnly: true,
    description: 'Fastest, least accurate. English-only.',
  },
  {
    name: 'base',
    label: 'Base',
    approxSizeMB: 148,
    englishOnly: false,
    description: 'Fast with reasonable accuracy.',
  },
  {
    name: 'base.en',
    label: 'Base (English)',
    approxSizeMB: 148,
    englishOnly: true,
    description: 'Fast with reasonable accuracy. English-only.',
  },
  {
    name: 'small',
    label: 'Small',
    approxSizeMB: 488,
    englishOnly: false,
    description: 'Good balance of speed and accuracy.',
  },
  {
    name: 'small.en',
    label: 'Small (English)',
    approxSizeMB: 488,
    englishOnly: true,
    description: 'Good balance of speed and accuracy. English-only.',
  },
  {
    name: 'medium',
    label: 'Medium',
    approxSizeMB: 1530,
    englishOnly: false,
    description: 'High accuracy, noticeably slower.',
  },
  {
    name: 'medium.en',
    label: 'Medium (English)',
    approxSizeMB: 1530,
    englishOnly: true,
    description: 'High accuracy, noticeably slower. English-only.',
  },
  {
    name: 'large-v3-turbo',
    label: 'Large v3 Turbo',
    approxSizeMB: 1620,
    englishOnly: false,
    description: 'Near-best accuracy at much better speed than Large.',
  },
  {
    name: 'large-v3',
    label: 'Large v3',
    approxSizeMB: 3100,
    englishOnly: false,
    description: 'Best accuracy, slowest and largest.',
  },
];

export type WhisperModelName = (typeof WHISPER_MODELS)[number]['name'];

export const DEFAULT_WHISPER_MODEL: WhisperModelName = 'small';

export interface WhisperModelStatus {
  name: WhisperModelName;
  downloaded: boolean;
  /** Actual on-disk size, present only once downloaded. */
  sizeBytes: number | null;
}

export interface WhisperDownloadProgress {
  model: WhisperModelName;
  downloadedBytes: number;
  /** Null when the server doesn't report a content length. */
  totalBytes: number | null;
}

export interface WhisperDownloadDone {
  model: WhisperModelName;
  success: boolean;
  cancelled: boolean;
  error: string | null;
}

/** Download state of every known model. */
export function listWhisperModels(): Promise<WhisperModelStatus[]> {
  return invoke('whisper_list_models');
}

/**
 * Starts downloading a model and resolves immediately; watch
 * `onWhisperDownloadProgress`/`onWhisperDownloadDone` for the outcome.
 * Rejects if the model is already downloaded or already downloading.
 */
export function downloadWhisperModel(model: WhisperModelName): Promise<void> {
  return invoke('whisper_download_model', { model });
}

/** Models with a download currently in flight. */
export function activeWhisperDownloads(): Promise<WhisperModelName[]> {
  return invoke('whisper_active_downloads');
}

export function cancelWhisperDownload(model: WhisperModelName): Promise<void> {
  return invoke('whisper_cancel_download', { model });
}

export function deleteWhisperModel(model: WhisperModelName): Promise<void> {
  return invoke('whisper_delete_model', { model });
}

export function onWhisperDownloadProgress(
  handler: (progress: WhisperDownloadProgress) => void,
): Promise<UnlistenFn> {
  return listen<WhisperDownloadProgress>('whisper:download-progress', (event) =>
    handler(event.payload),
  );
}

export function onWhisperDownloadDone(
  handler: (done: WhisperDownloadDone) => void,
): Promise<UnlistenFn> {
  return listen<WhisperDownloadDone>('whisper:download-done', (event) =>
    handler(event.payload),
  );
}
