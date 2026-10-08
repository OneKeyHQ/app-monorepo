import type {
  IMarketStockTokenVariant,
  IMarketStockTokenVariantsResponse,
} from '@onekeyhq/shared/types/marketV2';

import { selectMarketStockWatchlistVariant } from '../../../utils/stockTokenVariant';

import {
  getMarketStockVariantSummaryIdentities,
  parseMarketStockVariantTokenId,
} from './MarketStockStar.utils';

function createVariant(
  overrides: Partial<IMarketStockTokenVariant> = {},
): IMarketStockTokenVariant {
  return {
    tokenId: 'spot_token:ondo:evm--1:0x1',
    issuer: 'ondo',
    networkId: 'evm--1',
    contractAddress: '0x1',
    currency: 'USD',
    status: 'active',
    tradingEnabled: true,
    ...overrides,
  };
}

describe('MarketStockStar utilities', () => {
  it('parses the stock list token identity without inferring it from symbol', () => {
    expect(
      parseMarketStockVariantTokenId('spot_token:xstock:sol--101:XsbZ8eWbNKbT'),
    ).toEqual({
      chainId: 'sol--101',
      contractAddress: 'XsbZ8eWbNKbT',
    });
    expect(parseMarketStockVariantTokenId('invalid')).toBeUndefined();
  });

  it('filters malformed variant summaries', () => {
    expect(
      getMarketStockVariantSummaryIdentities([
        { tokenId: 'invalid', issuer: 'ondo' },
        {
          tokenId: 'spot_token:ondo:evm--56:0xaapl',
          issuer: 'ondo',
        },
      ]),
    ).toEqual([{ chainId: 'evm--56', contractAddress: '0xaapl' }]);
  });

  it('prefers the backend default even when it is temporarily unavailable', () => {
    const first = createVariant();
    const defaultVariant = createVariant({
      tokenId: 'spot_token:ondo:evm--56:0x2',
      networkId: 'evm--56',
      contractAddress: '0x2',
      isPaused: true,
    });
    const response: IMarketStockTokenVariantsResponse = {
      stockId: 'AAPL',
      items: [first, defaultVariant],
      defaultTokenId: defaultVariant.tokenId,
    };

    expect(selectMarketStockWatchlistVariant(response)).toBe(defaultVariant);
  });

  it('falls back to the first tradable variant', () => {
    const pausedDefault = createVariant({
      tokenId: 'spot_token:ondo:evm--56:0x2',
      isPaused: true,
    });
    const fallback = createVariant();

    expect(
      selectMarketStockWatchlistVariant({
        stockId: 'AAPL',
        items: [pausedDefault, fallback],
        defaultTokenId: 'missing',
      }),
    ).toBe(fallback);
  });

  it('falls back to the first variant when none are tradable', () => {
    const paused = createVariant({ isPaused: true });
    const disabled = createVariant({
      tokenId: 'spot_token:ondo:evm--56:0x2',
      tradingEnabled: false,
    });

    expect(
      selectMarketStockWatchlistVariant({
        stockId: 'AAPL',
        items: [paused, disabled],
        defaultTokenId: 'missing',
      }),
    ).toBe(paused);
  });
});
