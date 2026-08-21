import { invoke } from '@tauri-apps/api/core';

// All job working files live in app_cache_dir()/jobs/<jobId>/ on the Rust
// side; these commands are the only filesystem access the webview has.

/** Creates the job's working directory and returns its absolute path. */
export function createJobDir(jobId: string): Promise<string> {
  return invoke('job_create_dir', { jobId });
}

/** Reads a file inside the job's working directory (bare file names only). */
export function readJobText(jobId: string, fileName: string): Promise<string> {
  return invoke('job_read_text', { jobId, fileName });
}

/** Removes the job's working directory; missing directory is a no-op. */
export function cleanupJob(jobId: string): Promise<void> {
  return invoke('job_cleanup', { jobId });
}

/**
 * Moves the original to the OS recycle bin (recoverable) and puts the
 * trimmed clip at its path.
 */
export function trashReplace(original: string, trimmed: string): Promise<void> {
  return invoke('trash_replace', { original, trimmed });
}
