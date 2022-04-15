import { PayloadAction, createSlice } from '@reduxjs/toolkit';

type InitialState = {
  data: Record<string, any | boolean>;
};

const initialState: InitialState = {
  data: {},
};

export const dialogSlice = createSlice({
  name: 'dialog',
  initialState,
  reducers: {
    showDialog(state, action: PayloadAction<{ dialogId: string; args?: any }>) {
      const { dialogId, args } = action.payload;
      state.data[dialogId] = args || true;
    },
    hideDialog(state, action: PayloadAction<{ dialogId: string }>) {
      const { dialogId } = action.payload;

      state.data[dialogId] = undefined;
    },
  },
});

export const { showDialog, hideDialog } = dialogSlice.actions;

export default dialogSlice.reducer;
