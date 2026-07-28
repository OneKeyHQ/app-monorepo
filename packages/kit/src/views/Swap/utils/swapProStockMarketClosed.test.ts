import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import {
  SWAP_PRO_STOCK_MARKET_DETAIL_LAST_GOOD_TTL_MS,
  isSelectedProStockMarketClosed,
  isSelectedProStockMarketDetailActivationSettled,
  isSelectedProStockMarketDetailAuthoritative,
  isSelectedProStockMarketDetailResolved,
  isSelectedProStockTradingPaused,
  shouldDeferSelectedProStockQuoteErrorAlert,
} from './swapProStockMarketClosed';

const NETWORK_ID = 'evm--1';
const ADDRESS = '0xAAA';

function makeDetail(over?: {
  networkId?: string;
  address?: string;
  stockIsOpen?: boolean;
  stockIsPaused?: boolean;
}): IMarketTokenDetail {
  return {
    networkId: over?.networkId ?? NETWORK_ID,
    address: over?.address ?? ADDRESS,
    logoUrl: '',
    name: 'AAPLon',
    symbol: 'AAPLon',
    decimals: 18,
    stock: {
      isOpen: over?.stockIsOpen ?? false,
      isPaused: over?.stockIsPaused,
    },
  } as IMarketTokenDetail;
}

function makeToken(over?: Partial<ISwapToken>): ISwapToken {
  return {
    networkId: NETWORK_ID,
    contractAddress: ADDRESS,
    ...over,
  } as ISwapToken;
}

describe('isSelectedProStockMarketClosed', () => {
  it('is closed when the detail matches the selected token and the stock is closed', () => {
    expect(isSelectedProStockMarketClosed(makeDetail(), makeToken())).toBe(
      true,
    );
  });

  it('matches addresses case-insensitively on non-case-sensitive networks', () => {
    expect(
      isSelectedProStockMarketClosed(
        makeDetail(),
        makeToken({ contractAddress: '0xaaa' }),
      ),
    ).toBe(true);
  });

  it('is NOT closed when the detail belongs to a different token (stale detail)', () => {
    expect(
      isSelectedProStockMarketClosed(
        makeDetail(),
        makeToken({ contractAddress: '0xBBB' }),
      ),
    ).toBe(false);
  });

  it('is NOT closed when the detail is for a different network (stale detail)', () => {
    expect(
      isSelectedProStockMarketClosed(
        makeDetail(),
        makeToken({ networkId: 'evm--56' }),
      ),
    ).toBe(false);
  });

  it('is NOT closed when the matched stock market is open', () => {
    expect(
      isSelectedProStockMarketClosed(
        makeDetail({ stockIsOpen: true }),
        makeToken(),
      ),
    ).toBe(false);
  });

  it('is NOT closed when the detail or the selected token is missing', () => {
    expect(isSelectedProStockMarketClosed(undefined, makeToken())).toBe(false);
    expect(isSelectedProStockMarketClosed(makeDetail(), undefined)).toBe(false);
  });

  it('only resolves market status for the currently selected stock', () => {
    expect(
      isSelectedProStockMarketDetailResolved(makeDetail(), makeToken()),
    ).toBe(true);
    expect(
      isSelectedProStockMarketDetailResolved(
        makeDetail(),
        makeToken({ contractAddress: '0xBBB' }),
      ),
    ).toBe(false);
    expect(isSelectedProStockMarketDetailResolved(undefined, makeToken())).toBe(
      false,
    );
  });

  it('settles market detail only for the currently selected token activation', () => {
    const activationState = {
      contractAddress: ADDRESS,
      networkId: NETWORK_ID,
      settled: true,
    };
    expect(
      isSelectedProStockMarketDetailActivationSettled(
        activationState,
        makeToken(),
      ),
    ).toBe(true);
    expect(
      isSelectedProStockMarketDetailActivationSettled(
        activationState,
        makeToken({ contractAddress: '0xBBB' }),
      ),
    ).toBe(false);
    expect(
      isSelectedProStockMarketDetailActivationSettled(
        { ...activationState, settled: false },
        makeToken(),
      ),
    ).toBe(false);
  });

  it('keeps restrictive last-good detail authoritative only within its TTL', () => {
    const now = 100_000;
    const activationState = {
      contractAddress: ADDRESS,
      lastSuccessfulFetchAt: now - 1000,
      latestFetchSucceeded: false,
      networkId: NETWORK_ID,
      settled: true,
    };
    expect(
      isSelectedProStockMarketDetailAuthoritative(
        makeDetail(),
        activationState,
        makeToken(),
        now,
      ),
    ).toBe(true);
    expect(
      isSelectedProStockMarketDetailAuthoritative(
        makeDetail(),
        {
          ...activationState,
          lastSuccessfulFetchAt:
            now - SWAP_PRO_STOCK_MARKET_DETAIL_LAST_GOOD_TTL_MS - 1,
        },
        makeToken(),
        now,
      ),
    ).toBe(false);
    expect(
      isSelectedProStockMarketDetailAuthoritative(
        makeDetail({ stockIsOpen: true }),
        activationState,
        makeToken(),
        now,
      ),
    ).toBe(false);
  });

  it('recognizes a trading pause only for the currently selected stock', () => {
    expect(
      isSelectedProStockTradingPaused(
        makeDetail({ stockIsOpen: true, stockIsPaused: true }),
        makeToken(),
      ),
    ).toBe(true);
    expect(
      isSelectedProStockTradingPaused(
        makeDetail({ stockIsOpen: true, stockIsPaused: true }),
        makeToken({ contractAddress: '0xBBB' }),
      ),
    ).toBe(false);
  });

  it('defers only the matching Stock quote error while market detail is unresolved', () => {
    const baseParams = {
      hasAuthoritativeMarketRestriction: false,
      isStockTrade: true,
      marketDetailReconciled: false,
      quoteErrorMessage: 'Market is closed',
      visibleAlertTitle: 'Market is closed',
    };
    expect(shouldDeferSelectedProStockQuoteErrorAlert(baseParams)).toBe(true);
    expect(
      shouldDeferSelectedProStockQuoteErrorAlert({
        ...baseParams,
        hasAuthoritativeMarketRestriction: true,
      }),
    ).toBe(false);
    expect(
      shouldDeferSelectedProStockQuoteErrorAlert({
        ...baseParams,
        isStockTrade: false,
      }),
    ).toBe(false);
    expect(
      shouldDeferSelectedProStockQuoteErrorAlert({
        ...baseParams,
        marketDetailReconciled: true,
      }),
    ).toBe(false);
    expect(
      shouldDeferSelectedProStockQuoteErrorAlert({
        ...baseParams,
        visibleAlertTitle: 'Account unsupported',
      }),
    ).toBe(false);
  });
});
