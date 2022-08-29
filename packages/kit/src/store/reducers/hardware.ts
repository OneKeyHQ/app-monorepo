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
  passphraseState: string; // use passphrase, REQUEST_PASSPHRASE_ON_DEVICE only
};

export type HardwarePopup = {
  uiRequest?: string;
  payload?: HardwareUiEventPayload;
};

type InitialState = {
  connected: string[]; // connectId array
  passphraseOpened: string[]; // deviceId array, open passphrase device list
  lastCheckUpdateTime: Record<string, number>; // connectId -> time
};
const initialState: InitialState = {
  connected: [],
  passphraseOpened: [],
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
    updateDevicePassphraseOpenedState: (
      state,
      action: PayloadAction<{ deviceId: string; opened: boolean }>,
    ) => {
      if (action.payload.opened) {
        if (state.passphraseOpened.indexOf(action.payload.deviceId) === -1) {
          state.passphraseOpened = [
            ...state.passphraseOpened,
            action.payload.deviceId,
          ];
        }
      } else {
        state.passphraseOpened = state.passphraseOpened.filter(
          (id) => id !== action.payload.deviceId,
        );
      }
    },
  },
});

export const {
  addConnectedConnectId,
  removeConnectedConnectId,
  setHardwarePopup,
  closeHardwarePopup,
  updateDevicePassphraseOpenedState,
} = hardwareSlice.actions;

export default hardwareSlice.reducer;
