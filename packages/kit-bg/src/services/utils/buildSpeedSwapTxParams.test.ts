import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapQuoteKind,
} from '@onekeyhq/shared/types/swap/types';

import { buildSpeedSwapTxParams } from './buildSpeedSwapTxParams';

const fromToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '0xfrom',
  symbol: 'ETH',
  decimals: 18,
  isNative: true,
};

const toToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '0xto',
  symbol: 'USDC',
  decimals: 6,
  isNative: false,
};

describe('buildSpeedSwapTxParams', () => {
  it('keeps the market speed build payload aligned with branch x', () => {
    const result = buildSpeedSwapTxParams({
      fromToken,
      toToken,
      fromTokenAmount: '1.23',
      userAddress: '0xuser',
      provider: 'Swap1inchFusion',
      receivingAddress: '0xreceiver',
      slippagePercentage: 0.5,
      protocol: EProtocolOfExchange.SWAP,
      kind: ESwapQuoteKind.SELL,
      walletType: 'hd',
      quoteResultCtx: {
        oneInchFusionOrderCtx: {
          quoteId: 'quote-1',
        },
      },
    });

    expect(result).toEqual({
      fromTokenAddress: '0xfrom',
      toTokenAddress: '0xto',
      fromTokenAmount: '1.23',
      fromNetworkId: 'evm--1',
      toNetworkId: 'evm--1',
      protocol: EProtocolOfExchange.SWAP,
      provider: 'Swap1inchFusion',
      userAddress: '0xuser',
      receivingAddress: '0xreceiver',
      slippagePercentage: 0.5,
      kind: ESwapQuoteKind.SELL,
      walletType: 'hd',
      quoteResultCtx: {
        oneInchFusionOrderCtx: {
          quoteId: 'quote-1',
        },
      },
    });
    expect(result).not.toHaveProperty('toTokenAmount');
  });
});
