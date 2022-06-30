import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { CUSTOM_UI_RESPONSE } from '../../views/Hardware/PopupHandle';

export type HardwarePopup = {
  uiRequest?: string;
  visible?: boolean;
  payload?: any;
};

type InitialState = {
  hardwarePopup: HardwarePopup;
};
const initialState: InitialState = {
  hardwarePopup: {},
};
export const hardwareSlice = createSlice({
  name: 'hardware',
  initialState,
  reducers: {
    cancelHardwarePopup(state) {
      state.hardwarePopup = {
        ...state.hardwarePopup,
        uiRequest: CUSTOM_UI_RESPONSE.CUSTOM_CANCEL,
      };
    },
    setHardwarePopup(state, action: PayloadAction<HardwarePopup>) {
      state.hardwarePopup = action.payload;
    },
    changePopupVisible(
      state,
      action: PayloadAction<{ key: string; visible: boolean }>,
    ) {
      if (state.hardwarePopup.uiRequest === action.payload.key) {
        state.hardwarePopup = {
          ...state.hardwarePopup,
          visible: action.payload.visible,
        };
      }
    },
    closeHardwarePopup(state) {
      state.hardwarePopup = {};
    },
  },
});

export const {
  setHardwarePopup,
  cancelHardwarePopup,
  changePopupVisible,
  closeHardwarePopup,
} = hardwareSlice.actions;

export default hardwareSlice.reducer;
