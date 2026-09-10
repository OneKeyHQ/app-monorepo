/** @jest-environment jsdom */
import { renderHook } from '@testing-library/react';

import { transformApiItemToToken } from '../utils/tokenListHelpers';

import { useWatchlistFilteredGroups } from './useWatchlistFilteredGroups';

it('keeps chain tokens and native coins selectable while excluding listings and perps in swap', () => {
  const token = transformApiItemToToken(
    { address: '0xtoken', name: 'Token', symbol: 'TOK', decimals: 18 },
    { chainId: 'evm--1', networkLogoUri: '' },
  );
  const native = { ...token, address: '', isNative: true };
  const stockVariant = { ...token, stockId: 'AAPL' };
  const listings = [
    { ...token, address: '', networkId: '', assetId: 'bitcoin' },
    { ...token, address: '', networkId: '', stockId: 'AAPL' },
  ];
  const data = [
    token,
    native,
    stockVariant,
    ...listings,
    { ...token, perpsCoin: 'BTC' },
  ];
  const { result, rerender } = renderHook(
    ({ hideListings }) =>
      useWatchlistFilteredGroups(data, { hidePerps: true, hideListings }),
    { initialProps: { hideListings: true } },
  );
  expect(result.current.all).toEqual([token, native, stockVariant]);
  rerender({ hideListings: false });
  expect(result.current.all).toEqual([
    token,
    native,
    stockVariant,
    ...listings,
  ]);
});
