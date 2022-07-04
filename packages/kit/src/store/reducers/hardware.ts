import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { CUSTOM_UI_RESPONSE } from '../../views/Hardware/PopupHandle';

export type HardwarePopup = {
  uiRequest?: string;
  visible?: boolean;
  payload?: any;
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
    cancelHardwarePopup(state) {
      state.hardwarePopup = {
        ...state.hardwarePopup,
        uiRequest: CUSTOM_UI_RESPONSE.CUSTOM_CANCEL,
      };
    },
    setHardwarePopup(state, action: PayloadAction<HardwarePopup>) {
      state.hardwarePopup = action.payload;
    },
    visibleHardwarePopup(state, action: PayloadAction<string>) {
      if (state.hardwarePopup.uiRequest === action.payload) {
        state.hardwarePopup = {
          ...state.hardwarePopup,
          visible: true,
        };
      }
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
  cancelHardwarePopup,
  visibleHardwarePopup,
  closeHardwarePopup,
} = hardwareSlice.actions;

export default hardwareSlice.reducer;
