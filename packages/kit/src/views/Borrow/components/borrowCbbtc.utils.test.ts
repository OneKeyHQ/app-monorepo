// cspell:ignore cbbtc Cbbtc CBBTC

import type { IBorrowAsset } from '@onekeyhq/shared/types/staking';

import {
  isAaveCoreMarket,
  isCbbtcAsset,
  splitCbbtcAssets,
} from './borrowCbbtc.utils';

const asset = (symbol: string, amount: string) =>
  ({
    token: {
      symbol,
    },
    walletBalance: {
      number: amount,
      title: { text: amount },
      description: { text: amount },
    },
  }) as unknown as IBorrowAsset;

describe('borrowCbbtc.utils', () => {
  it('limits the special market to Aave Ethereum', () => {
    expect(
      isAaveCoreMarket({ providerName: 'Aave', networkId: 'evm--1' }),
    ).toBe(true);
    expect(
      isAaveCoreMarket({ providerName: 'Aave', networkId: 'evm--137' }),
    ).toBe(false);
    expect(
      isAaveCoreMarket({ providerName: 'Kamino', networkId: 'evm--1' }),
    ).toBe(false);
  });

  it('recognizes cbBTC case-insensitively', () => {
    expect(isCbbtcAsset(asset('cbBTC', '0'))).toBe(true);
    expect(isCbbtcAsset(asset('WBTC', '0'))).toBe(false);
  });

  it.each([
    ['zero raw balance', '0'],
    ['zero formatted balance', '0.00'],
  ])('folds cbBTC with %s', (_label, amount) => {
    const cbbtc = asset('cbBTC', amount);
    const usdc = asset('USDC', '0');

    expect(
      splitCbbtcAssets({
        assets: [cbbtc, usdc],
        providerName: 'aave',
        networkId: 'evm--1',
      }),
    ).toEqual({
      visibleAssets: [usdc],
      foldedAssets: [cbbtc],
    });
  });

  it('keeps positive cbBTC in the regular data set', () => {
    const cbbtc = asset('cbBTC', '0.01');
    expect(
      splitCbbtcAssets({
        assets: [cbbtc],
        providerName: 'aave',
        networkId: 'evm--1',
      }),
    ).toEqual({
      visibleAssets: [cbbtc],
      foldedAssets: [],
    });
  });

  it('does not change other markets', () => {
    const cbbtc = asset('cbBTC', '0');
    expect(
      splitCbbtcAssets({
        assets: [cbbtc],
        providerName: 'aave',
        networkId: 'evm--137',
      }),
    ).toEqual({
      visibleAssets: [cbbtc],
      foldedAssets: [],
    });
  });
});
