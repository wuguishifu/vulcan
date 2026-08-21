mod api_token;
mod claude;
mod ffmpeg;
mod jobs;
mod whisper;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_store::Builder::default().build())
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_dialog::init())
    .manage(ffmpeg::FfmpegJobs::default())
    .manage(whisper::WhisperState::default())
    .invoke_handler(tauri::generate_handler![
      api_token::set_api_token,
      api_token::delete_api_token,
      api_token::has_api_token,
      ffmpeg::ffmpeg_run,
      ffmpeg::ffmpeg_kill,
      ffmpeg::ffmpeg_running,
      whisper::whisper_run,
      whisper::whisper_kill,
      whisper::whisper_running,
      whisper::whisper_list_models,
      whisper::whisper_download_model,
      whisper::whisper_active_downloads,
      whisper::whisper_cancel_download,
      whisper::whisper_delete_model,
      claude::claude_list_models,
      claude::claude_send_message,
      jobs::job_create_dir,
      jobs::job_read_text,
      jobs::job_cleanup,
      jobs::trash_replace
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
