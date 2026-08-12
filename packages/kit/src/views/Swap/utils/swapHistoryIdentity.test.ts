import type {
  IFetchBuildTxResponse,
  ISwapTxHistory,
} from '@onekeyhq/shared/types/swap/types';
import { EProtocolOfExchange } from '@onekeyhq/shared/types/swap/types';

import {
  buildSwapHistoryIdentity,
  getSwapHistoryProviderOrderId,
  shortenSwapOrderId,
} from './swapHistoryIdentity';

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

describe('getSwapHistoryProviderOrderId', () => {
  function createHistory({
    ctx,
    orderId,
  }: {
    ctx?: ISwapTxHistory['ctx'];
    orderId?: string;
  }): ISwapTxHistory {
    return {
      ctx,
      txInfo: { orderId },
    } as ISwapTxHistory;
  }

  it('prefers the CoW order uid over the internal service order id (Stock orders)', () => {
    expect(
      getSwapHistoryProviderOrderId(
        createHistory({
          ctx: { cowSwapOrderId: '0xcow-order-uid' },
          orderId: 'internal-service-uuid',
        }),
      ),
    ).toBe('0xcow-order-uid');
  });

  it('falls back to txInfo.orderId when ctx has no provider order id', () => {
    expect(
      getSwapHistoryProviderOrderId(createHistory({ orderId: 'swft-order-1' })),
    ).toBe('swft-order-1');
  });

  it('returns undefined when no order id exists at all', () => {
    expect(getSwapHistoryProviderOrderId(createHistory({}))).toBeUndefined();
  });
});

describe('shortenSwapOrderId', () => {
  const buildId = (length: number) =>
    Array.from({ length }, (_, i) => String.fromCharCode(97 + (i % 26))).join(
      '',
    );

  it('abbreviates a long CoW order uid to a single line', () => {
    const uid = `0x${'a'.repeat(112)}`;
    const shortened = shortenSwapOrderId(uid);
    expect(shortened).toBe(`${uid.slice(0, 24)}...${uid.slice(-20)}`);
    expect(shortened.length).toBe(47);
  });

  it('never repeats characters for mid-length ids', () => {
    // Below leading+trailing the two slices would overlap, rendering the middle
    // of the id twice and making the output longer than the input.
    for (const length of [15, 20, 36, 43, 44]) {
      const id = buildId(length);
      const shortened = shortenSwapOrderId(id);
      expect(shortened).toBe(id);
    }
  });

  it('starts abbreviating once the id is longer than leading+trailing', () => {
    const id = buildId(45);
    expect(shortenSwapOrderId(id)).toBe(
      `${id.slice(0, 24)}...${id.slice(-20)}`,
    );
  });

  it('returns an empty string for a missing order id', () => {
    expect(shortenSwapOrderId(undefined)).toBe('');
  });
});
