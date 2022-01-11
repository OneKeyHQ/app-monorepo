import { PayloadAction, createSlice } from '@reduxjs/toolkit';

// TODO: strong type definition
type Account = {
  address: string;
  label: string;
};

type InitialState = {
  address: Account['address'];
  label: Account['address'];
};

const initialState: InitialState = {
  address: '0x76f3f64cb3cd19debee51436df630a342b736c24',
  label: 'Wallet',
};

export const accountSlicer = createSlice({
  name: 'account',
  initialState,
  reducers: {
    updateActiveAddress: (state, action: PayloadAction<string>) => {
      state.address = action.payload;
    },
  },
});

export const { updateActiveAddress } = accountSlicer.actions;

export default accountSlicer.reducer;
