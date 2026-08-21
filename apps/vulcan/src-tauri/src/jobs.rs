use std::fs;
use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager};

// Per-job working files (extracted audio, transcripts, trimmed clips) live in
// app_cache_dir()/jobs/<job_id>/. JS only ever composes path *strings* for
// ffmpeg/whisper args; reads and deletes go through these commands so the
// webview never gets filesystem access beyond this directory.

fn validate_job_id(job_id: &str) -> Result<(), String> {
  let valid = !job_id.is_empty()
    && job_id
      .chars()
      .all(|c| c.is_ascii_alphanumeric() || c == '-');
  if valid {
    Ok(())
  } else {
    Err(format!("invalid job id: {job_id}"))
  }
}

fn job_dir(app: &AppHandle, job_id: &str) -> Result<PathBuf, String> {
  validate_job_id(job_id)?;
  Ok(
    app
      .path()
      .app_cache_dir()
      .map_err(|e| e.to_string())?
      .join("jobs")
      .join(job_id),
  )
}

#[tauri::command]
pub fn job_create_dir(app: AppHandle, job_id: String) -> Result<String, String> {
  let dir = job_dir(&app, &job_id)?;
  fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  Ok(dir.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn job_read_text(app: AppHandle, job_id: String, file_name: String) -> Result<String, String> {
  if file_name.is_empty()
    || file_name.contains('/')
    || file_name.contains('\\')
    || file_name.contains("..")
  {
    return Err(format!("invalid file name: {file_name}"));
  }
  let path = job_dir(&app, &job_id)?.join(&file_name);
  fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn job_cleanup(app: AppHandle, job_id: String) -> Result<(), String> {
  let dir = job_dir(&app, &job_id)?;
  if dir.exists() {
    fs::remove_dir_all(&dir).map_err(|e| e.to_string())?;
  }
  Ok(())
}

/// Moves `original` to the OS recycle bin (recoverable) and puts `trimmed`
/// in its place. Runs on the async runtime so the blocking trash/copy work
/// doesn't stall the main thread.
#[tauri::command]
pub async fn trash_replace(original: String, trimmed: String) -> Result<(), String> {
  if !Path::new(&original).is_file() {
    return Err(format!("original file not found: {original}"));
  }
  if !Path::new(&trimmed).is_file() {
    return Err(format!("trimmed file not found: {trimmed}"));
  }

  trash::delete(&original).map_err(|e| format!("could not move original to recycle bin: {e}"))?;

  // The trimmed clip lives in the app cache, which may be on a different
  // volume than the original — rename fails across devices, so fall back to
  // copy + delete.
  if fs::rename(&trimmed, &original).is_err() {
    fs::copy(&trimmed, &original).map_err(|e| {
      format!("could not put trimmed clip at the original path ({e}); the original video is recoverable from the recycle bin and the trimmed clip is still at {trimmed}")
    })?;
    let _ = fs::remove_file(&trimmed);
  }
  Ok(())
}
