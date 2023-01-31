import { createSlice } from '@reduxjs/toolkit';

import type { PayloadAction } from '@reduxjs/toolkit';

export type GeneralInitialState = {
  activeAccountId: string | null;
  activeWalletId: string | null;
  activeNetworkId: string | null;
  activeExternalWalletName: string | null;
};

const initialState: GeneralInitialState = {
  activeAccountId: null,
  activeNetworkId: null,
  activeWalletId: null,
  activeExternalWalletName: null,
} as const;

export const generalSlice = createSlice({
  name: 'general',
  initialState,
  reducers: {
    setActiveIds(
      state,
      action: PayloadAction<
        Pick<
          GeneralInitialState,
          'activeAccountId' | 'activeNetworkId' | 'activeWalletId'
        >
      >,
    ) {
      const { activeAccountId, activeNetworkId, activeWalletId } =
        action.payload;
      state.activeAccountId = activeAccountId;
      state.activeWalletId = activeWalletId;
      state.activeNetworkId = activeNetworkId;
    },
    changeActiveAccount(
      state,
      action: PayloadAction<
        Pick<GeneralInitialState, 'activeAccountId' | 'activeWalletId'>
      >,
    ) {
      const { activeAccountId, activeWalletId } = action.payload;
      state.activeAccountId = activeAccountId;
      state.activeWalletId = activeWalletId;
    },
    changeActiveNetwork(
      state,
      action: PayloadAction<
        NonNullable<GeneralInitialState['activeNetworkId']>
      >,
    ) {
      state.activeNetworkId = action.payload;
    },
    changeActiveExternalWalletName(
      state,
      action: PayloadAction<
        NonNullable<GeneralInitialState['activeExternalWalletName']>
      >,
    ) {
      state.activeExternalWalletName = action.payload;
    },
  },
});

export const {
  changeActiveAccount,
  changeActiveNetwork,
  setActiveIds,
  changeActiveExternalWalletName,
} = generalSlice.actions;

export default generalSlice.reducer;
