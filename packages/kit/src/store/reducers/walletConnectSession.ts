import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import type { IWalletConnectSession } from '@walletconnect/types';

export type Session = {
  session: IWalletConnectSession | null;
};

const initialState: Session = {
  session: null,
};

export const sessionSlice = createSlice({
  name: 'connectSession',
  initialState,
  reducers: {
    updateWalletConnectSession(
      state,
      action: PayloadAction<IWalletConnectSession>,
    ) {
      state.session = { ...action.payload };
    },
    closeWalletConnectSession(
      state,
      action: PayloadAction<IWalletConnectSession | null>,
    ) {
      if (!action.payload || !action.payload.connected) {
        state.session = null;
      }
    },
  },
});

export const { updateWalletConnectSession, closeWalletConnectSession } =
  sessionSlice.actions;
export default sessionSlice.reducer;
