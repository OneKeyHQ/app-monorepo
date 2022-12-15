import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { OverviewDefiRes } from '../../views/Overview/types';

type InitialState = {
  // token: {
  //   [id: string]: Token[]
  // },
  // nft: {
  //   [id: string]: NFT[]
  // }
  defi?: {
    // id = networkId + address
    [id: string]: OverviewDefiRes[];
  };
};

const initialState: InitialState = {
  defi: {},
};

type OverviewPayloadDefi = {
  networkId: string;
  address: string;
  data: OverviewDefiRes[];
};

export const OverviewSlice = createSlice({
  name: 'overview',
  initialState,
  reducers: {
    setOverviewPortfolioDefi(
      state,
      action: PayloadAction<OverviewPayloadDefi>,
    ) {
      const { networkId, address, data } = action.payload;
      const id = `${networkId}--${address}`;
      if (!state.defi) {
        state.defi = {};
      }
      state.defi[id] = data;
    },
  },
});

export const { setOverviewPortfolioDefi } = OverviewSlice.actions;

export default OverviewSlice.reducer;
