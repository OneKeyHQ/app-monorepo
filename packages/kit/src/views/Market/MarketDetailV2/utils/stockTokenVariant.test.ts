import type { IMarketStockTokenVariant } from '@onekeyhq/shared/types/marketV2';

import { getStockTokenVariantActionIdentity } from './stockTokenVariant';

const variant: IMarketStockTokenVariant = {
  tokenId: 'aapl-ondo',
  issuer: 'ondo',
  networkId: 'evm--1',
  contractAddress: '0xstock',
  currency: 'USD',
  status: 'active',
  tradingEnabled: true,
};

describe('getStockTokenVariantActionIdentity', () => {
  it('keeps a valid favorite identity when the optional symbol is absent', () => {
    expect(getStockTokenVariantActionIdentity(variant)).toEqual({
      networkId: 'evm--1',
      address: '0xstock',
      symbol: undefined,
    });
  });

  it.each([
    { networkId: '', contractAddress: '0xstock' },
    { networkId: 'evm--1', contractAddress: '' },
  ])('rejects an incomplete chain identity: %o', (identity) => {
    expect(
      getStockTokenVariantActionIdentity({ ...variant, ...identity }),
    ).toBeUndefined();
  });
});
