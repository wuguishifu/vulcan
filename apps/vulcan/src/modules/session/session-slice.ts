import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type SessionState = {
  isProcessing: boolean;
};

const initialState: SessionState = {
  isProcessing: false,
};

const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    setIsProcessing(state, action: PayloadAction<boolean>) {
      state.isProcessing = action.payload;
    },
  },
});

export const { setIsProcessing } = sessionSlice.actions;
export const sessionReducer = sessionSlice.reducer;
