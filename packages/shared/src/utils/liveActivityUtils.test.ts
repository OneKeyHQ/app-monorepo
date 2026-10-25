import {
  EProtocolOfExchange,
  ESwapCrossChainStatus,
  ESwapExtraStatus,
  ESwapTxHistoryStatus,
} from '../../types/swap/types';

import {
  buildLiveActivityPushContent,
  buildSwapLiveActivitySnapshot,
  canAdvanceLiveActivityStatus,
  getLiveActivityStatus,
  getLiveActivityTimeProjection,
  getSwapLiveActivityOrderKey,
  normalizeLiveActivityDuration,
} from './liveActivityUtils';

import type { ISwapTxHistory } from '../../types/swap/types';

function createHistory(): ISwapTxHistory {
  const token = {
    networkId: 'btc--0',
    contractAddress: '',
    decimals: 8,
    symbol: 'BTC',
    isNative: true,
  };
  return {
    protocol: EProtocolOfExchange.SWAP,
    status: ESwapTxHistoryStatus.PENDING,
    accountInfo: {
      sender: { networkId: 'btc--0' },
      receiver: { networkId: 'evm--1' },
    },
    baseInfo: {
      fromToken: token,
      toToken: {
        ...token,
        networkId: 'evm--1',
        symbol: 'USDC',
        isNative: false,
      },
      fromAmount: '1',
      toAmount: '1',
    },
    txInfo: {
      txId: 'initial-deposit',
      sender: 'test-sender',
      receiver: 'test-receiver',
    },
    swapInfo: {
      provider: { provider: 'mock', providerName: 'Mock' },
      instantRate: '1',
      orderId: 'service-order',
    },
    date: { created: 1_000_000, updated: 1_000_000 },
  };
}

describe('Live Activity order projection', () => {
  it('accepts only broadcast native Bitcoin mainnet swap outflows', () => {
    const history = createHistory();
    expect(buildSwapLiveActivitySnapshot(history)?.order.orderKey).toBe(
      'swap:service-order',
    );
    for (const change of [
      { protocol: EProtocolOfExchange.PRIVATE_SEND },
      { txInfo: { ...history.txInfo, txId: '' } },
      {
        baseInfo: {
          ...history.baseInfo,
          fromToken: { ...history.baseInfo.fromToken, isNative: false },
        },
      },
      {
        baseInfo: {
          ...history.baseInfo,
          fromToken: { ...history.baseInfo.fromToken, networkId: 'btc--1' },
        },
      },
    ])
      expect(
        buildSwapLiveActivitySnapshot({ ...history, ...change }),
      ).toBeUndefined();
  });

  it('preserves an order identity and fixed estimate across replacement deposits', () => {
    const history = createHistory();
    history.swapInfo.orderId = undefined;
    history.swapInfo.liveActivityOrderKey =
      getSwapLiveActivityOrderKey(history);
    const original = buildSwapLiveActivitySnapshot(history);
    history.txInfo.txId = 'accelerated-deposit';
    history.swapInfo.orderId = 'late-service-order';
    const replaced = buildSwapLiveActivitySnapshot(history);
    expect(replaced?.order.orderKey).toBe(original?.order.orderKey);
    expect(replaced?.order.estimatedEndAtMs).toBe(
      original?.order.estimatedEndAtMs,
    );
  });

  it('projects a confirmed cancellation using the existing Swap cancellation semantics', () => {
    const history = createHistory();
    history.status = ESwapTxHistoryStatus.CANCELING;
    expect(
      buildSwapLiveActivitySnapshot(history, {
        state: ESwapTxHistoryStatus.SUCCESS,
      })?.content.status,
    ).toBe('canceled');
  });

  it('produces every required Swift ContentState field for APNs', () => {
    const snapshot = buildSwapLiveActivitySnapshot(createHistory());
    expect(snapshot).toBeDefined();
    if (!snapshot) return;
    expect(
      JSON.parse(
        JSON.stringify(
          buildLiveActivityPushContent(
            snapshot.order,
            snapshot.content,
            1_000_000,
          ),
        ),
      ),
    ).toEqual({
      ...snapshot.content,
      displayPhase: 'eta',
      etaMinutes: 10,
      almostDone: false,
      imageRevision: 0,
    });
  });
  it('includes the refund progress stop timestamp in the complete push content', () => {
    const snapshot = buildSwapLiveActivitySnapshot(createHistory());
    expect(snapshot).toBeDefined();
    if (!snapshot) return;
    const content = {
      ...snapshot.content,
      status: 'refunding' as const,
      updatedAtMs: 1_030_000,
    };
    expect(
      buildLiveActivityPushContent(snapshot.order, content, 1_060_000)
        .progressStoppedAtMs,
    ).toBe(1_030_000);
  });

  it.each([undefined, 0, -10, 'invalid', Infinity])(
    'falls back to ten minutes for %s',
    (value) => expect(normalizeLiveActivityDuration(value)).toBe(600),
  );

  it('uses the provider refund meaning before its coarse success/failed state', () => {
    expect(
      getLiveActivityStatus({
        status: ESwapTxHistoryStatus.SUCCESS,
        extraStatus: ESwapExtraStatus.REFUNDED,
      }),
    ).toBe('refunded');
    expect(
      getLiveActivityStatus({
        status: ESwapTxHistoryStatus.FAILED,
        crossChainStatus: ESwapCrossChainStatus.REFUNDING,
      }),
    ).toBe('refunding');
    expect(getLiveActivityStatus({ status: ESwapTxHistoryStatus.FAILED })).toBe(
      'failed',
    );
  });

  it('does not confuse confirmation or partial fill with completion', () => {
    expect(
      getLiveActivityStatus({
        status: ESwapTxHistoryStatus.PENDING,
        crossChainStatus: ESwapCrossChainStatus.FROM_SUCCESS,
      }),
    ).toBe('swapping');
    expect(
      getLiveActivityStatus({ status: ESwapTxHistoryStatus.PARTIALLY_FILLED }),
    ).toBe('confirming');
  });

  it('preserves completed results but allows a failed order to refund', () => {
    expect(canAdvanceLiveActivityStatus('done', 'confirming')).toBe(false);
    expect(canAdvanceLiveActivityStatus('refunded', 'done')).toBe(false);
    expect(canAdvanceLiveActivityStatus('failed', 'refunding')).toBe(true);
    expect(canAdvanceLiveActivityStatus('refunding', 'confirming')).toBe(false);
  });

  it('rounds minutes up, caps time progress, and only finishes on order truth', () => {
    const order = { startedAtMs: 0, estimatedEndAtMs: 300_000 };
    expect(getLiveActivityTimeProjection(order, 'confirming', 40_000)).toEqual({
      minutes: 5,
      almostDone: false,
      progress: 40_000 / 300_000,
    });
    expect(
      getLiveActivityTimeProjection(order, 'confirming', 290_000).almostDone,
    ).toBe(false);
    expect(
      getLiveActivityTimeProjection(order, 'confirming', 290_001).almostDone,
    ).toBe(true);
    expect(
      getLiveActivityTimeProjection(order, 'confirming', 400_000).progress,
    ).toBe(0.95);
    expect(getLiveActivityTimeProjection(order, 'done', 60_000)).toEqual({
      minutes: 4,
      almostDone: false,
      progress: 1,
    });
  });
});
