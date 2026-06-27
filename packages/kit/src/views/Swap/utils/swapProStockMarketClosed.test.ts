import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { isSelectedProStockMarketClosed } from './swapProStockMarketClosed';

const NETWORK_ID = 'evm--1';
const ADDRESS = '0xAAA';

function makeDetail(over?: {
  networkId?: string;
  address?: string;
  stockIsOpen?: boolean;
}): IMarketTokenDetail {
  return {
    networkId: over?.networkId ?? NETWORK_ID,
    address: over?.address ?? ADDRESS,
    logoUrl: '',
    name: 'AAPLon',
    symbol: 'AAPLon',
    decimals: 18,
    stock: { isOpen: over?.stockIsOpen ?? false },
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
});
