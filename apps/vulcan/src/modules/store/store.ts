import { combineReducers, configureStore } from '@reduxjs/toolkit';
import {
  FLUSH,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
  REHYDRATE,
  persistReducer,
  persistStore,
} from 'redux-persist';
import { sessionReducer } from '@/modules/session/session-slice';
import { settingsReducer } from '@/modules/settings/settings-slice';
import { tauriStorage } from './tauri-storage';

const rootReducer = combineReducers({
  session: sessionReducer,
  settings: settingsReducer,
});

const persistedReducer = persistReducer(
  {
    key: 'root',
    version: 1,
    storage: tauriStorage,
    // session state is ephemeral and must not survive app restarts
    blacklist: ['session'],
  },
  rootReducer,
);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // redux-persist dispatches actions carrying non-serializable payloads
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;
