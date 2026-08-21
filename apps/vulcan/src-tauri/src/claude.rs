use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::api_token;

const API_BASE: &str = "https://api.anthropic.com";
const API_VERSION: &str = "2023-06-01";

// Non-streaming requests can run for minutes when the model thinks over a
// long transcript, so the HTTP timeout is generous.
const REQUEST_TIMEOUT: Duration = Duration::from_secs(600);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeModel {
  id: String,
  display_name: String,
}

#[derive(Deserialize)]
struct ModelsResponse {
  data: Vec<ModelEntry>,
}

#[derive(Deserialize)]
struct ModelEntry {
  id: String,
  display_name: String,
}

#[derive(Deserialize)]
struct MessagesResponse {
  content: Vec<ContentBlock>,
  stop_reason: Option<String>,
  stop_details: Option<StopDetails>,
}

#[derive(Deserialize)]
struct ContentBlock {
  #[serde(rename = "type")]
  block_type: String,
  #[serde(default)]
  text: String,
}

#[derive(Deserialize)]
struct StopDetails {
  explanation: Option<String>,
}

#[derive(Deserialize)]
struct ErrorResponse {
  error: Option<ErrorBody>,
}

#[derive(Deserialize)]
struct ErrorBody {
  message: Option<String>,
}

fn client() -> Result<reqwest::Client, String> {
  reqwest::Client::builder()
    .timeout(REQUEST_TIMEOUT)
    .build()
    .map_err(|e| e.to_string())
}

fn status_error(status: reqwest::StatusCode, body: &str, model: Option<&str>) -> String {
  match status.as_u16() {
    401 => "invalid API token".into(),
    403 => "API token does not have permission for this request".into(),
    404 => match model {
      Some(model) => format!("unknown model: {model}"),
      None => "not found".into(),
    },
    429 => "rate limited — try again shortly".into(),
    500..=599 => "Anthropic API unavailable — try again".into(),
    _ => serde_json::from_str::<ErrorResponse>(body)
      .ok()
      .and_then(|r| r.error)
      .and_then(|e| e.message)
      .unwrap_or_else(|| format!("API request failed with status {status}")),
  }
}

#[tauri::command]
pub async fn claude_list_models() -> Result<Vec<ClaudeModel>, String> {
  let token = api_token::get_token()?;
  let response = client()?
    .get(format!("{API_BASE}/v1/models?limit=100"))
    .header("x-api-key", &token)
    .header("anthropic-version", API_VERSION)
    .send()
    .await
    .map_err(|e| e.to_string())?;

  let status = response.status();
  let body = response.text().await.map_err(|e| e.to_string())?;
  if !status.is_success() {
    return Err(status_error(status, &body, None));
  }

  let parsed: ModelsResponse = serde_json::from_str(&body).map_err(|e| e.to_string())?;
  Ok(
    parsed
      .data
      .into_iter()
      .map(|m| ClaudeModel {
        id: m.id,
        display_name: m.display_name,
      })
      .collect(),
  )
}

/// Sends a single-turn message and returns the concatenated text blocks of
/// the response. The token is read from the keychain here so it never
/// crosses into the webview; prompts stay on the JS side.
#[tauri::command]
pub async fn claude_send_message(
  model: String,
  system: String,
  user_message: String,
  max_tokens: u32,
) -> Result<String, String> {
  let token = api_token::get_token()?;
  let response = client()?
    .post(format!("{API_BASE}/v1/messages"))
    .header("x-api-key", &token)
    .header("anthropic-version", API_VERSION)
    .json(&json!({
      "model": model,
      "max_tokens": max_tokens,
      "system": system,
      "messages": [{ "role": "user", "content": user_message }],
    }))
    .send()
    .await
    .map_err(|e| e.to_string())?;

  let status = response.status();
  let body = response.text().await.map_err(|e| e.to_string())?;
  if !status.is_success() {
    return Err(status_error(status, &body, Some(&model)));
  }

  let parsed: MessagesResponse = serde_json::from_str(&body).map_err(|e| e.to_string())?;
  match parsed.stop_reason.as_deref() {
    Some("max_tokens") => {
      return Err("response truncated — increase max tokens".into());
    }
    Some("refusal") => {
      let explanation = parsed
        .stop_details
        .and_then(|d| d.explanation)
        .unwrap_or_else(|| "the model declined this request".into());
      return Err(format!("request refused: {explanation}"));
    }
    _ => {}
  }

  Ok(
    parsed
      .content
      .into_iter()
      .filter(|block| block.block_type == "text")
      .map(|block| block.text)
      .collect::<Vec<_>>()
      .join(""),
  )
}
