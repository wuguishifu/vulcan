use keyring::Entry;

// Stable keychain identity — changing either orphans previously saved tokens.
const SERVICE: &str = "dev.wuguishifu.vulcan";
const ACCOUNT: &str = "claude-api-token";

fn entry() -> Result<Entry, String> {
  Entry::new(SERVICE, ACCOUNT).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_api_token(token: String) -> Result<(), String> {
  if token.trim().is_empty() {
    return Err("token must not be empty".into());
  }
  entry()?.set_password(&token).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_api_token() -> Result<(), String> {
  match entry()?.delete_credential() {
    Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
    Err(e) => Err(e.to_string()),
  }
}

#[tauri::command]
pub async fn has_api_token() -> Result<bool, String> {
  match entry()?.get_password() {
    Ok(_) => Ok(true),
    Err(keyring::Error::NoEntry) => Ok(false),
    Err(e) => Err(e.to_string()),
  }
}
