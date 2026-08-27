import type { IMarketTokenListItem } from '@onekeyhq/shared/types/marketV2';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { buildStockPositionTokens } from './swapStockPositionsUtils';

const ethToken = {
  networkId: 'evm--1',
  contractAddress: '0xeth',
  symbol: 'ETH',
} as ISwapToken;
const stockToken = {
  networkId: 'evm--1',
  contractAddress: '0xstock',
  symbol: 'STOCK',
} as ISwapToken;
const buildMarketItem = (
  stock?: IMarketTokenListItem['stock'],
): IMarketTokenListItem => ({
  address: '',
  decimals: 18,
  name: '',
  stock,
  symbol: '',
});

describe('swapStockPositionsUtils', () => {
  it('keeps only position tokens with complete authoritative Stock metadata', () => {
    const stock = { isOpen: true } as NonNullable<ISwapToken['stock']>;

    expect(
      buildStockPositionTokens({
        marketItems: [buildMarketItem(), buildMarketItem(stock)],
        tokens: [ethToken, stockToken],
      }),
    ).toEqual([{ ...stockToken, isStock: true, stock }]);
    expect(
      buildStockPositionTokens({
        marketItems: [buildMarketItem(stock)],
        tokens: [ethToken, stockToken],
      }),
    ).toBeUndefined();
  });
});
