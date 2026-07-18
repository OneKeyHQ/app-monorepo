/** @jest-environment jsdom */

import { ESwapQuoteKind, ESwapTabSwitchType } from '../../types/swap/types';

import { buildSwapQuoteExecutionFingerprint } from './swapQuoteFingerprint';

import type { IFetchSwapQuoteParams } from '../../types/swap/types';

const request: IFetchSwapQuoteParams = {
  fromToken: {
    contractAddress: '',
    decimals: 18,
    isNative: true,
    networkId: 'evm--1',
    symbol: 'ETH',
  },
  fromTokenAmount: '1',
  kind: ESwapQuoteKind.SELL,
  protocol: ESwapTabSwitchType.SWAP,
  slippagePercentage: 0.5,
  toToken: {
    contractAddress: '0xusdc',
    decimals: 6,
    isNative: false,
    networkId: 'evm--1',
    symbol: 'USDC',
  },
};

describe('swapQuoteFingerprint', () => {
  it('hashes UTF-8 input without relying on a global TextEncoder', () => {
    const textEncoderDescriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      'TextEncoder',
    );
    Object.defineProperty(globalThis, 'TextEncoder', {
      configurable: true,
      value: undefined,
    });

    try {
      expect(
        buildSwapQuoteExecutionFingerprint({
          ...request,
          receivingAddress: '测试.eth',
        }),
      ).toMatch(/^[0-9a-f]{64}$/);
    } finally {
      if (textEncoderDescriptor) {
        Object.defineProperty(globalThis, 'TextEncoder', textEncoderDescriptor);
      } else {
        Reflect.deleteProperty(globalThis, 'TextEncoder');
      }
    }
  });
});
