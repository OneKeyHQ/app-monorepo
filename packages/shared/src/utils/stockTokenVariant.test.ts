import { getDefaultStockTokenVariant } from './stockTokenVariant';

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
