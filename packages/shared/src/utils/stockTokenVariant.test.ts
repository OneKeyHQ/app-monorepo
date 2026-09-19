import {
  getDefaultStockTokenVariant,
  isStockTokenVariantTradable,
} from './stockTokenVariant';
import type { IMarketStockTokenVariant } from '@onekeyhq/shared/types/marketV2';

function buildVariant(
  overrides: Partial<IMarketStockTokenVariant>,
): IMarketStockTokenVariant {
  return {
    tokenId: 'token',
    issuer: 'Other',
    networkId: 'network',
    contractAddress: '0x1',
    currency: 'USD',
    status: 'active',
    tradingEnabled: true,
    ...overrides,
  };
}

describe('stockTokenVariant', () => {
  it('keeps the backend default ahead of the issuer fallback order', () => {
    const bStocks = buildVariant({
      tokenId: 'bstocks',
      issuer: 'bStocks',
    });
    const backendDefault = buildVariant({
      tokenId: 'backend-default',
      issuer: 'Ondo',
      networkName: 'BSC',
    });

    expect(
      getDefaultStockTokenVariant([bStocks, backendDefault], 'backend-default'),
    ).toBe(backendDefault);
  });

  it('uses bStocks, Ondo BSC, then xStocks Solana as fallback priority', () => {
    const xStocks = buildVariant({
      tokenId: 'xstocks',
      issuer: 'xStocks',
      networkName: 'Solana',
    });
    const ondoBsc = buildVariant({
      tokenId: 'ondo-bsc',
      issuer: 'Ondo',
      networkName: 'BSC',
    });
    const bStocks = buildVariant({
      tokenId: 'bstocks',
      issuer: 'bStocks',
      networkName: 'Ethereum',
    });

    expect(getDefaultStockTokenVariant([xStocks, ondoBsc, bStocks])).toBe(
      bStocks,
    );
    expect(isStockTokenVariantTradable(bStocks)).toBe(true);
  });
});
