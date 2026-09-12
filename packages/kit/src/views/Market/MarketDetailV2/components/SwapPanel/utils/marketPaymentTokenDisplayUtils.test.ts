import { resolveMarketPaymentTokenDisplay } from './marketPaymentTokenDisplayUtils';

import type { IToken } from '../types';

const usdc: IToken = {
  contractAddress: '0xusdc',
  decimals: 6,
  isNative: false,
  logoURI: 'https://example.com/usdc.png',
  networkId: 'evm--1',
  speedSwapDefaultAmount: [],
  symbol: 'USDC',
};
const usdt: IToken = {
  ...usdc,
  contractAddress: '0xusdt',
  logoURI: 'https://example.com/usdt.png',
  symbol: 'USDT',
};

describe('resolveMarketPaymentTokenDisplay', () => {
  it('keeps the loading presentation until the scoped preference is ready', () => {
    expect(
      resolveMarketPaymentTokenDisplay({
        candidates: [usdc, usdt],
        preferenceReady: false,
      }),
    ).toBeUndefined();
  });

  it('keeps a current valid selection stable during preference revalidation', () => {
    expect(
      resolveMarketPaymentTokenDisplay({
        candidates: [usdc, usdt],
        paymentToken: { ...usdt },
        preferenceReady: false,
      }),
    ).toBe(usdt);
  });

  it('selects the saved candidate without exposing an empty token state', () => {
    expect(
      resolveMarketPaymentTokenDisplay({
        candidates: [usdc, usdt],
        preference: {
          contractAddress: usdt.contractAddress,
          networkId: usdt.networkId,
          symbol: usdt.symbol,
        },
        preferenceReady: true,
      }),
    ).toBe(usdt);
  });

  it('falls back to the first live candidate when the preference is stale', () => {
    expect(
      resolveMarketPaymentTokenDisplay({
        candidates: [usdc, usdt],
        preference: {
          contractAddress: '0xmissing',
          networkId: 'evm--1',
          symbol: 'MISSING',
        },
        preferenceReady: true,
      }),
    ).toBe(usdc);
  });
});
