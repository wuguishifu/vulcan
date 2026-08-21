use std::collections::HashMap;
use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

// Running ffmpeg jobs, keyed by OS pid. Entries are removed on exit or kill.
#[derive(Default)]
pub struct FfmpegJobs(Mutex<HashMap<u32, CommandChild>>);

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

/// Spawns the bundled ffmpeg sidecar with the given args and returns a job id.
/// Progress is streamed to the webview as `ffmpeg:log` events (ffmpeg writes
/// all diagnostics to stderr) and completion as a single `ffmpeg:exit` event.
#[tauri::command]
pub async fn ffmpeg_run(
  app: AppHandle,
  jobs: State<'_, FfmpegJobs>,
  args: Vec<String>,
) -> Result<u32, String> {
  let (mut rx, child) = app
    .shell()
    .sidecar("ffmpeg")
    .map_err(|e| e.to_string())?
    .args(&args)
    .spawn()
    .map_err(|e| e.to_string())?;

  let id = child.pid();
  jobs.0.lock().unwrap().insert(id, child);

  tauri::async_runtime::spawn(async move {
    while let Some(event) = rx.recv().await {
      match event {
        CommandEvent::Stdout(bytes) => {
          let _ = app.emit(
            "ffmpeg:log",
            LogPayload {
              id,
              stream: "stdout",
              line: String::from_utf8_lossy(&bytes).into_owned(),
            },
          );
        }
        CommandEvent::Stderr(bytes) => {
          let _ = app.emit(
            "ffmpeg:log",
            LogPayload {
              id,
              stream: "stderr",
              line: String::from_utf8_lossy(&bytes).into_owned(),
            },
          );
        }
        CommandEvent::Error(message) => {
          let _ = app.emit(
            "ffmpeg:log",
            LogPayload {
              id,
              stream: "error",
              line: message,
            },
          );
        }
        CommandEvent::Terminated(payload) => {
          app.state::<FfmpegJobs>().0.lock().unwrap().remove(&id);
          let _ = app.emit(
            "ffmpeg:exit",
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
pub async fn ffmpeg_kill(jobs: State<'_, FfmpegJobs>, id: u32) -> Result<(), String> {
  // Killing an already-finished job is a no-op; the exit event still fires
  // from the reader task with whatever code the process died with.
  let child = jobs.0.lock().unwrap().remove(&id);
  match child {
    Some(child) => child.kill().map_err(|e| e.to_string()),
    None => Ok(()),
  }
}

#[tauri::command]
pub fn ffmpeg_running(jobs: State<'_, FfmpegJobs>) -> Vec<u32> {
  jobs.0.lock().unwrap().keys().copied().collect()
}
