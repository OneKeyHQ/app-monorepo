import { swapDefaultSetTokens } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import { getMarketSwapDefaultPair } from './marketSwapDefaultPair';

const eth = swapDefaultSetTokens['evm--1'].fromToken as ISwapToken;
const usdc = swapDefaultSetTokens['evm--1'].toToken as ISwapToken;
const usdt: ISwapToken = { ...usdc, contractAddress: '0xusdt', symbol: 'USDT' };
const target: ISwapToken = {
  ...eth,
  isNative: false,
  contractAddress: '0xtarget',
  symbol: 'TARGET',
};

describe('Market entry default candidates', () => {
  it.each(['from', 'to'] as const)(
    'uses supplied candidate order for %s',
    (direction) => {
      const pair = getMarketSwapDefaultPair({
        token: target,
        direction,
        defaultTokens: [eth, usdt, usdc],
      });
      expect(pair).toEqual({
        fromToken: direction === 'from' ? target : usdt,
        toToken: direction === 'to' ? target : usdt,
        swapType: ESwapTabSwitchType.SWAP,
      });
    },
  );
  it('chooses the next candidate when the target is itself a stablecoin', () => {
    expect(
      getMarketSwapDefaultPair({
        token: usdc,
        defaultTokens: [eth, usdc, usdt],
      }).fromToken,
    ).toBe(usdt);
  });
  it('keeps the target without inventing a native or cross-chain fallback', () => {
    expect(
      getMarketSwapDefaultPair({ token: usdc, defaultTokens: [eth, usdc] }),
    ).toEqual({
      fromToken: undefined,
      toToken: usdc,
      swapType: ESwapTabSwitchType.SWAP,
    });
    expect(
      getMarketSwapDefaultPair({
        token: { ...target, networkId: 'evm--747474' },
        defaultTokens: [],
      }).fromToken,
    ).toBeUndefined();
  });
  it('retains an existing configured cross-chain stablecoin candidate', () => {
    const btc = { ...eth, networkId: 'btc--0', symbol: 'BTC', decimals: 8 };
    expect(
      getMarketSwapDefaultPair({ token: btc, defaultTokens: [usdt] }),
    ).toEqual({
      fromToken: usdt,
      toToken: btc,
      swapType: ESwapTabSwitchType.BRIDGE,
    });
  });
  it('drops unsupported candidates without adding another default', () => {
    const pair = getMarketSwapDefaultPair({
      token: target,
      defaultTokens: [usdt, usdc],
      isSupported: (token) => token !== usdt,
    });
    expect(pair.fromToken).toBe(usdc);
  });
  it('rejects an unsupported target', () => {
    expect(
      getMarketSwapDefaultPair({
        token: target,
        defaultTokens: [usdc],
        isSupported: (token) => token !== target,
      }),
    ).toEqual({
      fromToken: undefined,
      toToken: undefined,
      swapType: ESwapTabSwitchType.SWAP,
    });
  });
});
