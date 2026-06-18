import type { IFetchBuildTxResponse } from '@onekeyhq/shared/types/swap/types';
import { EProtocolOfExchange } from '@onekeyhq/shared/types/swap/types';

import { buildSwapHistoryIdentity } from './swapHistoryIdentity';

function createBuildRes(
  overrides: Partial<IFetchBuildTxResponse> = {},
): IFetchBuildTxResponse {
  return {
    result: {
      info: {
        provider: 'stock-provider',
        providerName: 'Stock Provider',
      },
      fromTokenInfo: {
        networkId: 'evm--56',
        contractAddress: '0xusdc',
        symbol: 'USDC',
        decimals: 6,
        isNative: false,
      },
      toTokenInfo: {
        networkId: 'evm--56',
        contractAddress: '0xstock',
        symbol: 'ONDO',
        decimals: 18,
        isNative: false,
      },
      fromAmount: '100',
      toAmount: '10',
      quoteId: 'quote-1',
    },
    ...overrides,
  } as IFetchBuildTxResponse;
}

describe('swapHistoryIdentity', () => {
  it('uses Stock service order id as the pending history primary id when no txid exists', () => {
    expect(
      buildSwapHistoryIdentity({
        buildRes: createBuildRes({ orderId: 'stock-order-1' }),
        protocol: EProtocolOfExchange.STOCK,
      }),
    ).toEqual({
      serviceOrderId: 'stock-order-1',
      orderId: 'stock-order-1',
      useOrderId: true,
    });
  });

  it('keeps txid as the primary id for Stock rows that have a txid', () => {
    expect(
      buildSwapHistoryIdentity({
        buildRes: createBuildRes({ orderId: 'stock-order-1' }),
        protocol: EProtocolOfExchange.STOCK,
        txId: '0xtx',
      }),
    ).toEqual({
      serviceOrderId: 'stock-order-1',
      orderId: undefined,
      useOrderId: false,
    });
  });

  it('keeps existing order-backed provider ids as history ids', () => {
    expect(
      buildSwapHistoryIdentity({
        buildRes: createBuildRes({
          ctx: {
            oneInchFusionOrderHash: 'fusion-order-1',
          },
        }),
        protocol: EProtocolOfExchange.SWAP,
        txId: '0xtx',
      }),
    ).toEqual({
      serviceOrderId: 'quote-1',
      orderId: 'fusion-order-1',
      useOrderId: true,
    });
  });
});
