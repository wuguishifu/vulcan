use std::collections::HashMap;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use futures_util::StreamExt;
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

/// Models whisper-cli can use, in ggml naming. Downloads resolve to
/// https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-<name>.bin
const MODELS: &[&str] = &[
  "tiny",
  "tiny.en",
  "base",
  "base.en",
  "small",
  "small.en",
  "medium",
  "medium.en",
  "large-v3-turbo",
  "large-v3",
];

#[derive(Default)]
pub struct WhisperState {
  // Running whisper-cli jobs, keyed by OS pid. Entries are removed on exit or kill.
  jobs: Mutex<HashMap<u32, CommandChild>>,
  // In-flight model downloads, keyed by model name; the flag cancels.
  downloads: Mutex<HashMap<String, Arc<AtomicBool>>>,
}

#[derive(Clone, Serialize)]
struct LogPayload {
  id: u32,
  stream: &'static str,
  line: String,
}

#[derive(Clone, Serialize)]
struct ExitPayload {
  id: u32,
  code: Option<i32>,
  success: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelStatus {
  name: &'static str,
  downloaded: bool,
  size_bytes: Option<u64>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DownloadProgressPayload {
  model: String,
  downloaded_bytes: u64,
  total_bytes: Option<u64>,
}

#[derive(Clone, Serialize)]
struct DownloadDonePayload {
  model: String,
  success: bool,
  cancelled: bool,
  error: Option<String>,
}

fn models_dir(app: &AppHandle) -> Result<PathBuf, String> {
  let dir = app
    .path()
    .app_data_dir()
    .map_err(|e| e.to_string())?
    .join("whisper-models");
  fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  Ok(dir)
}

fn model_file(app: &AppHandle, model: &str) -> Result<PathBuf, String> {
  if !MODELS.contains(&model) {
    return Err(format!("unknown model: {model}"));
  }
  Ok(models_dir(app)?.join(format!("ggml-{model}.bin")))
}

/// Spawns the bundled whisper-cli sidecar against a downloaded model and
/// returns a job id. The `-m <model path>` flag is injected here so the
/// webview never handles filesystem paths; everything else (input file,
/// output format, language, threads) comes in through `args`. Output is
/// streamed as `whisper:log` events and completion as `whisper:exit`.
#[tauri::command]
pub async fn whisper_run(
  app: AppHandle,
  state: State<'_, WhisperState>,
  model: String,
  args: Vec<String>,
) -> Result<u32, String> {
  let model_path = model_file(&app, &model)?;
  if !model_path.exists() {
    return Err(format!("model not downloaded: {model}"));
  }

  let (mut rx, child) = app
    .shell()
    .sidecar("whisper-cli")
    .map_err(|e| e.to_string())?
    .args(["-m".to_string(), model_path.to_string_lossy().into_owned()])
    .args(&args)
    .spawn()
    .map_err(|e| e.to_string())?;

  let id = child.pid();
  state.jobs.lock().unwrap().insert(id, child);

  tauri::async_runtime::spawn(async move {
    while let Some(event) = rx.recv().await {
      match event {
        CommandEvent::Stdout(bytes) => {
          let _ = app.emit(
            "whisper:log",
            LogPayload {
              id,
              stream: "stdout",
              line: String::from_utf8_lossy(&bytes).into_owned(),
            },
          );
        }
        CommandEvent::Stderr(bytes) => {
          let _ = app.emit(
            "whisper:log",
            LogPayload {
              id,
              stream: "stderr",
              line: String::from_utf8_lossy(&bytes).into_owned(),
            },
          );
        }
        CommandEvent::Error(message) => {
          let _ = app.emit(
            "whisper:log",
            LogPayload {
              id,
              stream: "error",
              line: message,
            },
          );
        }
        CommandEvent::Terminated(payload) => {
          app.state::<WhisperState>().jobs.lock().unwrap().remove(&id);
          let _ = app.emit(
            "whisper:exit",
            ExitPayload {
              id,
              code: payload.code,
              success: payload.code == Some(0),
            },
          );
        }
        _ => {}
      }
    }
  });

  Ok(id)
}

#[tauri::command]
pub async fn whisper_kill(state: State<'_, WhisperState>, id: u32) -> Result<(), String> {
  // Killing an already-finished job is a no-op; the exit event still fires
  // from the reader task with whatever code the process died with.
  let child = state.jobs.lock().unwrap().remove(&id);
  match child {
    Some(child) => child.kill().map_err(|e| e.to_string()),
    None => Ok(()),
  }
}

#[tauri::command]
pub fn whisper_running(state: State<'_, WhisperState>) -> Vec<u32> {
  state.jobs.lock().unwrap().keys().copied().collect()
}

#[tauri::command]
pub fn whisper_list_models(app: AppHandle) -> Result<Vec<ModelStatus>, String> {
  let dir = models_dir(&app)?;
  Ok(
    MODELS
      .iter()
      .map(|name| {
        let size_bytes = fs::metadata(dir.join(format!("ggml-{name}.bin")))
          .ok()
          .map(|m| m.len());
        ModelStatus {
          name,
          downloaded: size_bytes.is_some(),
          size_bytes,
        }
      })
      .collect(),
  )
}

/// Starts downloading a model into the app data dir and returns immediately.
/// Progress is streamed as `whisper:download-progress` events and the final
/// outcome (success, failure, or cancellation) as `whisper:download-done`.
#[tauri::command]
pub async fn whisper_download_model(
  app: AppHandle,
  state: State<'_, WhisperState>,
  model: String,
) -> Result<(), String> {
  let dest = model_file(&app, &model)?;
  if dest.exists() {
    return Err(format!("model already downloaded: {model}"));
  }

  let cancel = Arc::new(AtomicBool::new(false));
  {
    let mut downloads = state.downloads.lock().unwrap();
    if downloads.contains_key(&model) {
      return Err(format!("download already in progress: {model}"));
    }
    downloads.insert(model.clone(), cancel.clone());
  }

  tauri::async_runtime::spawn(async move {
    let result = download_model(&app, &model, &dest, &cancel).await;
    app
      .state::<WhisperState>()
      .downloads
      .lock()
      .unwrap()
      .remove(&model);
    let _ = app.emit(
      "whisper:download-done",
      DownloadDonePayload {
        model: model.clone(),
        success: result.is_ok(),
        cancelled: cancel.load(Ordering::Relaxed),
        error: result.err(),
      },
    );
  });

  Ok(())
}

async fn download_model(
  app: &AppHandle,
  model: &str,
  dest: &Path,
  cancel: &AtomicBool,
) -> Result<(), String> {
  let url = format!("https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-{model}.bin");
  let response = reqwest::get(&url)
    .await
    .map_err(|e| e.to_string())?
    .error_for_status()
    .map_err(|e| e.to_string())?;
  let total_bytes = response.content_length();

  // Download to a .part file and rename only on success, so a partial file
  // never counts as a downloaded model.
  let part = dest.with_extension("bin.part");
  let mut file = fs::File::create(&part).map_err(|e| e.to_string())?;
  let mut stream = response.bytes_stream();
  let mut downloaded_bytes: u64 = 0;
  let mut last_emitted: u64 = 0;

  let result: Result<(), String> = loop {
    match stream.next().await {
      Some(Ok(bytes)) => {
        if cancel.load(Ordering::Relaxed) {
          break Err("cancelled".into());
        }
        if let Err(e) = file.write_all(&bytes) {
          break Err(e.to_string());
        }
        downloaded_bytes += bytes.len() as u64;
        // At most one event per 8 MiB so the webview isn't flooded.
        if downloaded_bytes - last_emitted >= 8 * 1024 * 1024 {
          last_emitted = downloaded_bytes;
          let _ = app.emit(
            "whisper:download-progress",
            DownloadProgressPayload {
              model: model.to_string(),
              downloaded_bytes,
              total_bytes,
            },
          );
        }
      }
      Some(Err(e)) => break Err(e.to_string()),
      None => break Ok(()),
    }
  };

  drop(file);
  match result {
    Ok(()) => {
      fs::rename(&part, dest).map_err(|e| e.to_string())?;
      let _ = app.emit(
        "whisper:download-progress",
        DownloadProgressPayload {
          model: model.to_string(),
          downloaded_bytes,
          total_bytes,
        },
      );
      Ok(())
    }
    Err(e) => {
      let _ = fs::remove_file(&part);
      Err(e)
    }
  }
}

/// Models with a download currently in flight, so the UI can restore
/// progress indicators after a page remount.
#[tauri::command]
pub fn whisper_active_downloads(state: State<'_, WhisperState>) -> Vec<String> {
  state.downloads.lock().unwrap().keys().cloned().collect()
}

#[tauri::command]
pub fn whisper_cancel_download(state: State<'_, WhisperState>, model: String) -> Result<(), String> {
  // Cancelling a download that isn't running is a no-op; the download task
  // itself emits `whisper:download-done` once it stops.
  if let Some(cancel) = state.downloads.lock().unwrap().get(&model) {
    cancel.store(true, Ordering::Relaxed);
  }
  Ok(())
}

#[tauri::command]
pub fn whisper_delete_model(app: AppHandle, model: String) -> Result<(), String> {
  let path = model_file(&app, &model)?;
  if path.exists() {
    fs::remove_file(&path).map_err(|e| e.to_string())?;
  }
  Ok(())
}
