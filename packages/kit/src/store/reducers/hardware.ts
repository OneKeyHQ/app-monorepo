import { createSlice } from '@reduxjs/toolkit';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IOneKeyDeviceType } from '@onekeyhq/shared/types';

import type { KnownDevice } from '@onekeyfe/hd-core';
import type { PayloadAction } from '@reduxjs/toolkit';

export type HardwareUiEventPayload = {
  type?: string;
  deviceType?: IOneKeyDeviceType;
  deviceId: string;
  deviceConnectId: string;
  deviceBootLoaderMode?: boolean;
  passphraseState?: string; // use passphrase, REQUEST_PASSPHRASE_ON_DEVICE only
  supportInputPinOnSoftware?: boolean;
};

export type HardwarePopup = {
  uiRequest?: string;
  payload?: HardwareUiEventPayload;
};

type InitialState = {
  connected: string[]; // connectId array
  passphraseOpened: string[]; // deviceId array, open passphrase device list
  lastCheckUpdateTime: Record<string, number>; // connectId -> time
  updateFirmwareStep: string;
  pendingRememberWalletConnectId?: string;
  previousAddress?: {
    device: KnownDevice;
    data: { path?: string; address?: string };
  };
};
const initialState: InitialState = {
  connected: [],
  passphraseOpened: [],
  lastCheckUpdateTime: {},
  updateFirmwareStep: '',
  pendingRememberWalletConnectId: undefined,
  previousAddress: undefined,
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
      if (!platformEnv.isExtensionBackground) {
        const hardwarePopup =
          require('../../views/Hardware/PopupHandle/showHardwarePopup') as typeof import('../../views/Hardware/PopupHandle/showHardwarePopup');
        hardwarePopup.default(action.payload);
      }
    },
    closeHardwarePopup() {
      if (!platformEnv.isExtensionBackground) {
        const hardwarePopup =
          require('../../views/Hardware/PopupHandle/showHardwarePopup') as typeof import('../../views/Hardware/PopupHandle/showHardwarePopup');
        hardwarePopup.closeHardwarePopup();
      }
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
    setUpdateFirmwareStep: (state, action: PayloadAction<string>) => {
      state.updateFirmwareStep = action.payload;
    },
    setPendingRememberWalletConnectId: (
      state,
      action: PayloadAction<string | undefined>,
    ) => {
      state.pendingRememberWalletConnectId = action.payload;
    },
    setPreviousAddress(
      state,
      action: PayloadAction<InitialState['previousAddress']>,
    ) {
      state.previousAddress = action.payload;
    },
    clearPreviousAddress(state) {
      state.previousAddress = undefined;
    },
  },
});

export const {
  addConnectedConnectId,
  removeConnectedConnectId,
  setHardwarePopup,
  closeHardwarePopup,
  updateDevicePassphraseOpenedState,
  setUpdateFirmwareStep,
  setPendingRememberWalletConnectId,
  setPreviousAddress,
  clearPreviousAddress,
} = hardwareSlice.actions;

export default hardwareSlice.reducer;
