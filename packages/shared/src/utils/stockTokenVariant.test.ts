import {
  getDefaultStockTokenVariant,
  normalizeStockIssuer,
} from './stockTokenVariant';

import type { IMarketStockTokenVariant } from '../../types/marketV2';

const ondo: IMarketStockTokenVariant = {
  tokenId: 'aapl-ondo',
  issuer: 'ondo',
  networkId: 'evm--1',
  contractAddress: '0x01',
  currency: 'USD',
  status: 'active',
  tradingEnabled: true,
};
const preferred: IMarketStockTokenVariant = {
  ...ondo,
  tokenId: 'aapl-bstocks',
  issuer: ' bStocks ',
  contractAddress: '0x02',
};

it.each(['bstock', 'bstocks', ' bStock ', ' bStocks '])(
  'prefers the tradable issuer %s over the backend default',
  (issuer) => {
    const variant = { ...preferred, issuer };
    expect(getDefaultStockTokenVariant([ondo, variant], ondo.tokenId)).toBe(
      variant,
    );
  },
);

it.each([
  { tradingEnabled: false },
  { status: 'inactive' },
  { isPaused: true },
  { tradingHours: { isPaused: true } },
])('falls back when bStocks cannot trade: %o', (unavailable) => {
  expect(
    getDefaultStockTokenVariant([{ ...preferred, ...unavailable }, ondo]),
  ).toBe(ondo);
});

it('honors the backend network choice among preferred variants', () => {
  const second = { ...preferred, tokenId: 'aapl-bstocks-base' };
  expect(
    getDefaultStockTokenVariant([ondo, preferred, second], second.tokenId),
  ).toBe(second);
});

it('preserves the backend default without a preferred issuer', () => {
  const other = { ...ondo, tokenId: 'aapl-xstocks', issuer: 'xstocks' };
  expect(getDefaultStockTokenVariant([ondo, other], other.tokenId)).toBe(other);
  expect(getDefaultStockTokenVariant([])).toBeUndefined();
});

it.each([
  ['bStock', 'bstocks'],
  [' BSTOCKS ', 'bstocks'],
  ['coingecko', 'ondo'],
  ['Ondo', 'ondo'],
  ['xStock', 'xstocks'],
  ['dinari', 'dinari'],
  ['', ''],
  [undefined, ''],
])('normalizes issuer %p to %p', (issuer, expected) => {
  expect(normalizeStockIssuer(issuer)).toBe(expected);
});

describe('remembered issuer preference', () => {
  const xStocksVariant = {
    ...ondo,
    tokenId: 'aapl-xstocks',
    issuer: 'xStocks',
    contractAddress: '0x03',
  };

  it('picks the remembered issuer ahead of bStocks', () => {
    expect(
      getDefaultStockTokenVariant(
        [preferred, ondo, xStocksVariant],
        undefined,
        'Ondo',
      ),
    ).toBe(ondo);
  });

  it('matches the remembered issuer across spellings', () => {
    const coingecko = { ...ondo, issuer: 'coingecko' };
    expect(
      getDefaultStockTokenVariant([preferred, coingecko], undefined, 'ondo'),
    ).toBe(coingecko);
  });

  it('honors the backend network choice within the remembered issuer', () => {
    const ondoBase = {
      ...ondo,
      tokenId: 'aapl-ondo-base',
      contractAddress: '0x04',
    };
    expect(
      getDefaultStockTokenVariant(
        [preferred, ondo, ondoBase],
        ondoBase.tokenId,
        'ondo',
      ),
    ).toBe(ondoBase);
    expect(
      getDefaultStockTokenVariant(
        [preferred, ondo, ondoBase],
        preferred.tokenId,
        'ondo',
      ),
    ).toBe(ondo);
  });

  it('falls back to bStocks when the remembered issuer cannot trade', () => {
    expect(
      getDefaultStockTokenVariant(
        [{ ...ondo, isPaused: true }, preferred, xStocksVariant],
        undefined,
        'ondo',
      ),
    ).toBe(preferred);
  });

  it('falls back to bStocks when the stock lacks the remembered issuer', () => {
    expect(
      getDefaultStockTokenVariant([ondo, preferred], undefined, 'xstocks'),
    ).toBe(preferred);
  });

  it('falls back to list order when neither issuer is available', () => {
    expect(
      getDefaultStockTokenVariant([ondo, xStocksVariant], undefined, 'dinari'),
    ).toBe(ondo);
  });
});
