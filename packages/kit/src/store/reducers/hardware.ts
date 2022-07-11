import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { IOneKeyDeviceType } from '@onekeyhq/shared/types';

export type HardwareUiEventPayload = {
  type: string;
  deviceType: IOneKeyDeviceType;
  deviceConnectId: string;
  deviceBootLoaderMode: boolean;
};

export type HardwarePopup = {
  uiRequest?: string;
  payload?: HardwareUiEventPayload;
};

type InitialState = {
  hardwarePopup: HardwarePopup;
  connected: string[]; // connectId array
};
const initialState: InitialState = {
  hardwarePopup: {},
  connected: [],
};
export const hardwareSlice = createSlice({
  name: 'hardware',
  initialState,
  reducers: {
    addConnectedConnectId: (state, action: PayloadAction<string>) => {
      if (state.connected.indexOf(action.payload) === -1) {
        state.connected = [...state.connected, action.payload];
      }
    },
    removeConnectedConnectId: (state, action: PayloadAction<string>) => {
      state.connected = state.connected.filter((id) => id !== action.payload);
    },
    setHardwarePopup(state, action: PayloadAction<HardwarePopup>) {
      state.hardwarePopup = action.payload;
    },
    closeHardwarePopup(state) {
      state.hardwarePopup = {};
    },
  },
});

export const {
  addConnectedConnectId,
  removeConnectedConnectId,
  setHardwarePopup,
  closeHardwarePopup,
} = hardwareSlice.actions;

export default hardwareSlice.reducer;
