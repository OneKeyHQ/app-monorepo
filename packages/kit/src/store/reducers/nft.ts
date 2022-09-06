import { PayloadAction, createSlice } from '@reduxjs/toolkit';

type NFTPrice = 'floorPrice' | 'lastSalePrice';

type InitialState = {
  nftPrice: Record<string, Record<string, Record<NFTPrice, number>>>;
  nftSymbolPrice: Record<string, number>;
  disPlayPriceType: NFTPrice;
};

const initialState: InitialState = {
  nftPrice: {},
  nftSymbolPrice: {},
  disPlayPriceType: 'lastSalePrice',
};

type NFTPricePayloadAction = {
  accountId?: string | null;
  networkId?: string | null;
  price: Record<NFTPrice, number>;
};

type NFTSymbolPricePayloadAction = {
  networkId?: string | null;
  price: number;
};

export const networkSlice = createSlice({
  name: 'nft',
  initialState,
  reducers: {
    setDisPlayPriceType(state, action: PayloadAction<NFTPrice>) {
      state.disPlayPriceType = action.payload;
    },
    setNFTPrice(state, action: PayloadAction<NFTPricePayloadAction>) {
      const { accountId, networkId, price } = action.payload;
      if (!networkId || !accountId) {
        return;
      }
      const accountInfo = state.nftPrice[accountId] ?? {};
      const nftPrice = accountInfo[networkId] ?? {};
      if (nftPrice !== price) {
        accountInfo[networkId] = price;
        state.nftPrice[accountId] = accountInfo;
      }
    },
    setNFTSymbolPrice(
      state,
      action: PayloadAction<NFTSymbolPricePayloadAction>,
    ) {
      const { networkId, price } = action.payload;
      if (!networkId) {
        return;
      }
      const oldPrice = state.nftSymbolPrice[networkId] ?? {};
      if (oldPrice !== price) {
        state.nftSymbolPrice[networkId] = price;
      }
    },
  },
});

export const { setNFTPrice, setDisPlayPriceType, setNFTSymbolPrice } =
  networkSlice.actions;

export default networkSlice.reducer;
