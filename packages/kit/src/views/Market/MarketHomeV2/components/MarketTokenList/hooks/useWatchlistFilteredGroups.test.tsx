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

it('splits non-perps rows into spot and stocks without overlap', () => {
  const token = transformApiItemToToken(
    { address: '0xtoken', name: 'Token', symbol: 'TOK', decimals: 18 },
    { chainId: 'evm--1', networkLogoUri: '' },
  );
  const tokenizedStock = transformApiItemToToken(
    {
      address: 'Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh',
      name: 'NVDAx',
      symbol: 'NVDAx',
      decimals: 8,
      stock: { subtitle: 'NVIDIA', source: 'xstock', sourceLogoUri: '' },
    },
    { chainId: 'sol--101', networkLogoUri: '' },
  );
  const legacyStockToken = { ...token, id: 'legacy', stockId: 'AAPL' };
  const stockListing = {
    ...token,
    id: 'stock:AAPL',
    address: '',
    networkId: '',
    stockId: 'AAPL',
  };
  const assetListing = {
    ...token,
    id: 'asset:bitcoin',
    address: '',
    networkId: '',
    assetId: 'bitcoin',
  };
  const perps = { ...token, id: 'perps', perpsCoin: 'BTC' };
  const { result } = renderHook(() =>
    useWatchlistFilteredGroups([
      token,
      tokenizedStock,
      legacyStockToken,
      stockListing,
      assetListing,
      perps,
    ]),
  );
  expect(result.current.all).toHaveLength(6);
  expect(result.current.spot).toEqual([token, assetListing]);
  expect(result.current.stocks).toEqual([
    tokenizedStock,
    legacyStockToken,
    stockListing,
  ]);
  expect(result.current.perps).toEqual([perps]);
});
