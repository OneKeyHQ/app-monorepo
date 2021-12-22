import { PayloadAction, createSlice } from '@reduxjs/toolkit';

// TODO: strong type definition
type ChainId = string;

type InitialState = {
  chainId: ChainId;
};

const initialState: InitialState = {
  chainId: 'ethereum',
};

export const chainSlicer = createSlice({
  name: 'chain',
  initialState,
  reducers: {
    updateActiveChainId: (state, action: PayloadAction<string>) => {
      state.chainId = action.payload;
    },
  },
});

export const { updateActiveChainId } = chainSlicer.actions;

export default chainSlicer.reducer;
