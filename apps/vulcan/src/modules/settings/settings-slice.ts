import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { WhisperModelName } from '@/modules/whisper/models';

export type SettingsState = {
  /** Last whisper model the user picked on the home page. */
  whisperModel: WhisperModelName | null;
  /** Last Claude model the user picked on the home page. */
  claudeModel: string | null;
};

const initialState: SettingsState = {
  whisperModel: null,
  claudeModel: null,
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setWhisperModel(state, action: PayloadAction<WhisperModelName>) {
      state.whisperModel = action.payload;
    },
    setClaudeModel(state, action: PayloadAction<string>) {
      state.claudeModel = action.payload;
    },
  },
});

export const { setWhisperModel, setClaudeModel } = settingsSlice.actions;
export const settingsReducer = settingsSlice.reducer;
