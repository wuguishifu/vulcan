import { invoke } from '@tauri-apps/api/core';

// The token lives in the OS keychain (macOS Keychain / Windows Credential
// Manager) and is only ever read on the Rust side — it is never exposed to JS.

export function setApiToken(token: string): Promise<void> {
  return invoke('set_api_token', { token });
}

export function deleteApiToken(): Promise<void> {
  return invoke('delete_api_token');
}

export function hasApiToken(): Promise<boolean> {
  return invoke('has_api_token');
}
