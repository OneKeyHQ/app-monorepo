import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { IOneKeyDeviceType } from '@onekeyhq/shared/types';

import showHardwarePopup, {
  closeHardwarePopup as closeHardwarePopupUI,
} from '../../views/Hardware/PopupHandle/showHardwarePopup';

export type HardwareUiEventPayload = {
  type: string;
  deviceType: IOneKeyDeviceType;
  deviceId: string;
  deviceConnectId: string;
  deviceBootLoaderMode: boolean;
};

export type HardwarePopup = {
  uiRequest?: string;
  payload?: HardwareUiEventPayload;
};

type InitialState = {
  connected: string[]; // connectId array
  lastCheckUpdateTime: Record<string, number>; // connectId -> time
};
const initialState: InitialState = {
  connected: [],
  lastCheckUpdateTime: {},
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
    setHardwarePopup(_, action: PayloadAction<HardwarePopup>) {
      showHardwarePopup(action.payload);
    },
    closeHardwarePopup() {
      closeHardwarePopupUI();
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
