import { LazyStore } from '@tauri-apps/plugin-store';
import type { Storage } from 'redux-persist';

// The store file lives in the app's data directory (e.g. ~/Library/Application Support on macOS).
const STORE_FILE = 'redux-persist.json';

// The Tauri IPC bridge only exists inside the tauri webview, not during
// `next build` prerendering or when the dev server is opened in a plain browser.
const isTauri = () =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

function createTauriStorage(): Storage {
  const store = new LazyStore(STORE_FILE);

  return {
    async getItem(key: string): Promise<string | null> {
      return (await store.get<string>(key)) ?? null;
    },
    async setItem(key: string, value: string): Promise<void> {
      await store.set(key, value);
      await store.save();
    },
    async removeItem(key: string): Promise<void> {
      await store.delete(key);
      await store.save();
    },
  };
}

const noopStorage: Storage = {
  getItem: () => Promise.resolve(null),
  setItem: () => Promise.resolve(),
  removeItem: () => Promise.resolve(),
};

export const tauriStorage: Storage = isTauri()
  ? createTauriStorage()
  : noopStorage;
