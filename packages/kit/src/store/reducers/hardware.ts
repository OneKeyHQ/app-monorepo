import { PayloadAction, createSlice } from '@reduxjs/toolkit';

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
  },
});

export const { addConnectedConnectId, removeConnectedConnectId } =
  hardwareSlice.actions;

export default hardwareSlice.reducer;
