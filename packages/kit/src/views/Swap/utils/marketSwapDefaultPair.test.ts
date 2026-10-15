import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import {
  ARC_NETWORK_ID,
  swapDefaultSetTokens,
} from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { getMarketSwapDefaultPair } from './marketSwapDefaultPair';

const eth = swapDefaultSetTokens['evm--1'].fromToken as ISwapToken;
const usdc = swapDefaultSetTokens['evm--1'].toToken as ISwapToken;
const other = (networkId: string): ISwapToken => ({
  networkId,
  contractAddress: '0xother',
  symbol: 'OTHER',
  decimals: 18,
});

describe('Market default pairs', () => {
  it.each(
    Object.entries(swapDefaultSetTokens).filter(([, config]) => config.toToken),
  )(
    'uses the designated counterpart and reverses it for %s',
    (networkId, config) => {
      const preferred = config[
        config.marketDefaultToken ?? 'toToken'
      ] as ISwapToken;
      const token = other(networkId);
      expect(getMarketSwapDefaultPair({ token }).fromToken).toBe(preferred);
      const reverse = getMarketSwapDefaultPair({ token: preferred });
      expect(reverse.fromToken).toEqual(
        config.marketDefaultToken === 'fromToken'
          ? config.toToken
          : config.fromToken,
      );
      expect(
        equalTokenNoCaseSensitive({
          token1: reverse.fromToken,
          token2: reverse.toToken,
        }),
      ).toBe(false);
    },
  );

  it('pairs USDC with ETH regardless of other speed-config candidates', () => {
    expect(
      getMarketSwapDefaultPair({
        token: { ...usdc, contractAddress: usdc.contractAddress.toUpperCase() },
      }).fromToken,
    ).toBe(eth);
    expect(
      getMarketSwapDefaultPair({
        token: { ...other('evm--1'), symbol: 'USDT' },
      }).fromToken,
    ).toBe(usdc);
  });
  it('uses ARC USDC and Katana KAT without inferring stablecoins', () => {
    expect(
      getMarketSwapDefaultPair({ token: other(ARC_NETWORK_ID) }).fromToken
        ?.symbol,
    ).toBe('USDC');
    expect(
      getMarketSwapDefaultPair({ token: other('evm--747474') }).fromToken
        ?.symbol,
    ).toBe('KAT');
  });
  it.each([
    'btc--0',
    'ltc--0',
    'bch--0',
    'doge--0',
    'xrp--0',
    'kaspa--kaspa',
    'evm--1030',
    'near--0',
    'evm--999',
  ])('uses Ethereum USDC for %s', (networkId) => {
    const token = other(networkId);
    expect(getMarketSwapDefaultPair({ token })).toEqual({
      fromToken: usdc,
      toToken: token,
      swapType: ESwapTabSwitchType.BRIDGE,
    });
    expect(getMarketSwapDefaultPair({ token, direction: 'from' })).toEqual({
      fromToken: token,
      toToken: usdc,
      swapType: ESwapTabSwitchType.BRIDGE,
    });
  });
  it('uses loaded Swap capabilities to handle a configured but cross-chain-only network', () => {
    expect(
      getMarketSwapDefaultPair({
        token: other('evm--56'),
        isSupported: (_, type) => type === ESwapTabSwitchType.BRIDGE,
      }).fromToken,
    ).toBe(usdc);
  });
  it('falls back to the existing bridge default when the preferred token is unsupported', () => {
    const pair = getMarketSwapDefaultPair({
      token: other('btc--0'),
      isSupported: (token) => token !== usdc,
    });
    expect(pair.fromToken).toMatchObject({
      networkId: 'evm--1',
      symbol: 'ETH',
    });
  });
  it.each(['from', 'to'] as const)(
    'keeps only the current token when no counterpart is supported (%s)',
    (direction) => {
      const token = other('btc--0');
      const pair = getMarketSwapDefaultPair({
        token,
        direction,
        isSupported: (candidate) => candidate === token,
      });
      expect(pair.fromToken).toBe(direction === 'from' ? token : undefined);
      expect(pair.toToken).toBe(direction === 'to' ? token : undefined);
    },
  );
});
