import { createSelector } from '@reduxjs/toolkit';

import type { IAppState } from '..';

export const selectNFT = (state: IAppState) => state.nft;

export const selectNFTPrice = createSelector(selectNFT, (s) => s.nftPrice);

export const selectDisPlayPriceType = createSelector(
  selectNFT,
  (s) => s.disPlayPriceType,
);

export const selectNftSymbolPrice = createSelector(
  selectNFT,
  (s) => s.nftSymbolPrice,
);
