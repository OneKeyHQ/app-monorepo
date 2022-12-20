import { createSlice } from '@reduxjs/toolkit';
import B from 'bignumber.js';
import { set } from 'lodash';

import type { OverviewDefiRes } from '../../views/Overview/types';
import type { PayloadAction } from '@reduxjs/toolkit';

type AssetType = 'tokens' | 'nfts' | 'defis';

type TotalValues = Record<
  AssetType,
  {
    value: string;
    value24h: string;
  }
>;

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
  totalValues?: {
    // id = networkId + address
    [id: string]: TotalValues;
  };
};

const initialState: InitialState = {
  defi: {},
  totalValues: {},
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
      state.defi = set(
        {
          ...state.defi,
        },
        `${id}`,
        data,
      );
      let totalValue = new B(0);
      let totalValue24h = new B(0);
      for (const d of data) {
        totalValue = totalValue.plus(d.protocolValue);
        totalValue24h = totalValue24h.plus(d.protocolValue24h);
      }
      state.totalValues = set(
        {
          ...state.totalValues,
        },
        `${id}.defis`,
        {
          value: totalValue,
          value24h: totalValue24h,
        },
      );
    },
    setOverviewOnChainValue(
      state,
      action: PayloadAction<{
        networkId: string;
        address: string;
        assetType: AssetType;
        value: string;
        value24h: string;
      }>,
    ) {
      const { networkId, address, assetType, value, value24h } = action.payload;
      const id = `${networkId}--${address}`;
      state.totalValues = set(
        {
          ...state.totalValues,
        },
        `${id}.${assetType}`,
        {
          value,
          value24h,
        },
      );
    },
  },
});

export const { setOverviewPortfolioDefi, setOverviewOnChainValue } =
  OverviewSlice.actions;

export default OverviewSlice.reducer;
