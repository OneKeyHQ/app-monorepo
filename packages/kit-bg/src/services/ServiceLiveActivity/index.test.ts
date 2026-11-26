import ServiceLiveActivity from '.';

import {
  OneKeyLocalError,
  OneKeyServerApiError,
} from '@onekeyhq/shared/src/errors';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import enMessages from '@onekeyhq/shared/src/locale/json/en_US.json';
import zhMessages from '@onekeyhq/shared/src/locale/json/zh_CN.json';
import liveActivity from '@onekeyhq/shared/src/modules/LiveActivity';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import {
  buildLiveActivityPushContent,
  buildSwapLiveActivitySnapshot,
} from '@onekeyhq/shared/src/utils/liveActivityUtils';
import type {
  ILiveActivitySubscriptionResult,
  ILiveActivitySubscriptionTransport,
  ILiveActivitySystemStatus,
} from '@onekeyhq/shared/types/liveActivity';
import type { ISwapTxHistory } from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapCrossChainStatus,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';

import { createLazyServiceProxy } from '../../apis/lazyServiceProxy';
import { SimpleDbEntitySwapHistory } from '../../dbs/simple/entity/SimpleDbEntitySwapHistory';
import { inAppNotificationAtom } from '../../states/jotai/atoms';
import { globalJotaiStorageReadyHandler } from '../../states/jotai/jotaiStorage';
import ServiceSwap from '../ServiceSwap';

import { clearReplacementGuards } from './replacementGuard';
import {
  createServerLiveActivitySubscriptionTransport,
  liveActivityRemoteTracking,
} from './subscriptionTransport';

jest.mock('./subscriptionTransport', () => ({
  ...jest.requireActual<typeof import('./subscriptionTransport')>(
    './subscriptionTransport',
  ),
  createServerLiveActivitySubscriptionTransport: jest.fn(),
}));

const englishMessages: Record<string, string> = enMessages;
const chineseMessages: Record<string, string> = zhMessages;

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    ...jest.requireActual('@onekeyhq/shared/src/platformEnv').default,
    isNativeIOS: true,
  },
}));

function createHistory(
  direction: 'from-btc' | 'to-btc' = 'from-btc',
): ISwapTxHistory {
  const bitcoin = {
    networkId: 'btc--0',
    contractAddress: '',
    decimals: 8,
    symbol: 'BTC',
    isNative: true,
  };
  const usdc = {
    ...bitcoin,
    networkId: 'evm--1',
    symbol: 'USDC',
    isNative: false,
  };
  const [fromToken, toToken] =
    direction === 'from-btc' ? [bitcoin, usdc] : [usdc, bitcoin];
  return {
    protocol: EProtocolOfExchange.SWAP,
    status: ESwapTxHistoryStatus.PENDING,
    accountInfo: {
      sender: { networkId: fromToken.networkId },
      receiver: { networkId: toToken.networkId },
    },
    baseInfo: {
      fromToken,
      toToken,
      fromAmount: '1',
      toAmount: '1',
    },
    txInfo: {
      txId: 'deposit-a',
      sender: 'synthetic-sender',
      receiver: 'synthetic-receiver',
    },
    swapInfo: {
      provider: { provider: 'mock', providerName: 'Mock' },
      instantRate: '1',
      orderId: 'synthetic-order',
    },
    date: { created: Date.now(), updated: Date.now() },
  };
}

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (error: Error) => void = () => {};
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

describe('Live Activity subscription lifecycle', () => {
  const previousBackgroundScope = globalThis.$onekeyIsInBackground;
  let status: ILiveActivitySystemStatus;
  const serverTransport: jest.Mocked<ILiveActivitySubscriptionTransport> = {
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
  };
  beforeAll(() => {
    globalThis.$onekeyIsInBackground = true;
    globalJotaiStorageReadyHandler.resolveReady(true);
    appLocale.setLocale('en-US', englishMessages);
  });
  afterAll(() => {
    globalThis.$onekeyIsInBackground = previousBackgroundScope;
  });
  beforeEach(() => {
    jest.useFakeTimers({
      doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'],
    });
    serverTransport.subscribe.mockReset().mockResolvedValue({
      status: 'registered',
      subscriptionId: 'test-subscription',
      revision: 0,
    });
    serverTransport.unsubscribe.mockReset().mockResolvedValue(true);
    const stored = new Map<string, string>();
    jest
      .spyOn(appStorage, 'getItem')
      .mockImplementation(async (key) => stored.get(key) ?? null);
    jest.spyOn(appStorage, 'setItem').mockImplementation(async (key, value) => {
      stored.set(key, value);
    });
    jest.spyOn(appStorage, 'removeItem').mockImplementation(async (key) => {
      stored.delete(key);
    });
    jest
      .mocked(createServerLiveActivitySubscriptionTransport)
      .mockReturnValue(serverTransport);
    clearReplacementGuards();
    appLocale.setLocale('en-US', englishMessages);
    jest.spyOn(liveActivityRemoteTracking, 'isReady').mockResolvedValue(true);
    status = { supported: true, enabled: true, activities: [] };
    jest.spyOn(liveActivity, 'start').mockImplementation(async (snapshot) => {
      status.activities = [
        {
          ...snapshot,
          content: buildLiveActivityPushContent(
            snapshot.order,
            snapshot.content,
            Date.now(),
          ),
          activityId: 'synthetic-activity',
          activityState: 'active',
          pushRegistration: 'registered',
        },
      ];
      return status;
    });
    jest.spyOn(liveActivity, 'update').mockImplementation(async (snapshot) => {
      const current = status.activities[0];
      if (current)
        current.content = buildLiveActivityPushContent(
          snapshot.order,
          snapshot.content,
          Date.now(),
        );
      return status;
    });
    jest
      .spyOn(liveActivity, 'getStatus')
      .mockImplementation(async () => status);
    jest
      .spyOn(liveActivity, 'clearTracking')
      .mockImplementation(async () => status);
  });

  function createLocalOnlyActivity() {
    const start = jest.mocked(liveActivity.start).getMockImplementation();
    if (!start) throw new OneKeyLocalError('Missing mock');
    jest.mocked(liveActivity.start).mockImplementation(async (request) => {
      const nativeStatus = await start(request);
      for (const activity of nativeStatus.activities) {
        activity.pushRegistration = 'notRequested';
      }
      return nativeStatus;
    });
  }

  it.each(['from-btc', 'to-btc'] as const)(
    'passes logo URLs only in the start request for a %s swap',
    async (direction) => {
      createLocalOnlyActivity();
      const history = createHistory(direction);
      const { fromToken, toToken } = history.baseInfo;
      fromToken.logoURI = `https://uni.onekey-asset.com/${fromToken.symbol}.png`;
      toToken.logoURI = `https://uni.onekey-asset.com/${toToken.symbol}.png`;
      const service = new ServiceLiveActivity({ backgroundApi: {} });
      await service.onSwapBroadcast(history);
      expect(liveActivity.start).toHaveBeenCalledWith(
        expect.objectContaining({
          iconUrls: {
            from: fromToken.logoURI,
            to: toToken.logoURI,
          },
          supportsBtcReceivingPush: true,
          order: expect.objectContaining({
            fromToken: expect.objectContaining({ iconUrl: '' }),
            toToken: expect.objectContaining({ iconUrl: '' }),
          }),
        }),
      );
      await service.onSwapStatus({
        history,
        status: { state: ESwapTxHistoryStatus.PENDING },
      });
      expect(liveActivity.update).toHaveBeenCalledWith(
        expect.not.objectContaining({ iconUrls: expect.anything() }),
      );
    },
  );

  it('avoids periodic bridge reads and local status writes for a subscribed activity', async () => {
    const service = new ServiceLiveActivity({ backgroundApi: {} });
    const history = createHistory();
    await service.onSwapBroadcast(history);
    expect(serverTransport.subscribe).toHaveBeenCalledTimes(1);
    jest.mocked(liveActivity.getStatus).mockClear();
    await service.onSwapStatus({
      history,
      status: { state: ESwapTxHistoryStatus.SUCCESS },
    });
    await jest.advanceTimersByTimeAsync(59_999);
    expect(liveActivity.update).not.toHaveBeenCalled();
    expect(liveActivity.getStatus).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    expect(liveActivity.getStatus).toHaveBeenCalledTimes(1);
  });

  it('subscribes before lock when JPush acknowledges at 31 seconds', async () => {
    const start = jest.mocked(liveActivity.start).getMockImplementation();
    if (!start) throw new OneKeyLocalError('Missing mock');
    jest.mocked(liveActivity.start).mockImplementation(async (request) => {
      const nativeStatus = await start(request);
      nativeStatus.activities[0].pushRegistration = 'pending';
      return nativeStatus;
    });
    const service = new ServiceLiveActivity({ backgroundApi: {} });
    await service.onSwapBroadcast(createHistory());
    jest.mocked(appStorage.getItem).mockClear();
    await jest.advanceTimersByTimeAsync(30_000);
    expect(serverTransport.subscribe).not.toHaveBeenCalled();
    expect(appStorage.getItem).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1000);
    status.activities[0].pushRegistration = 'registered';
    await jest.advanceTimersByTimeAsync(1999);
    expect(serverTransport.subscribe).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    expect(serverTransport.subscribe).toHaveBeenCalledTimes(1);
  });

  it('prefetches Swap logo URLs without creating a card', async () => {
    const service = new ServiceLiveActivity({ backgroundApi: {} });
    const prefetch = jest.spyOn(liveActivity, 'prefetchIcons');
    const { fromToken, toToken } = createHistory().baseInfo;
    fromToken.logoURI = 'https://uni.onekey-asset.com/btc.png';
    toToken.logoURI = 'https://uni.onekey-asset.com/usdc.png';
    await service.prefetchSwapIcons({
      protocol: EProtocolOfExchange.SWAP,
      fromToken,
      toToken,
    });
    expect(prefetch).toHaveBeenCalledWith({
      urls: { from: fromToken.logoURI, to: toToken.logoURI },
    });
    expect(liveActivity.start).not.toHaveBeenCalled();
  });

  it('restores legacy card icons from the order and generic token metadata once', async () => {
    const history = createHistory();
    history.baseInfo.fromToken.logoURI = 'https://uni.onekey-asset.com/btc.png';
    Object.assign(history.baseInfo.toToken, { symbol: 'ETH', isNative: true });
    const loaded = deferred<void>();
    const prefetch = jest
      .spyOn(liveActivity, 'prefetchIcons')
      .mockImplementation(async () => loaded.resolve());
    const lookup = jest.fn().mockResolvedValue({
      logoURI: 'https://uni.onekey-asset.com/eth.png',
    });
    const readHistory = jest.fn().mockResolvedValue([history]);
    const service = new ServiceLiveActivity({
      backgroundApi: {
        simpleDb: { swapHistory: { getSwapHistoryList: readHistory } },
        serviceToken: { getNativeToken: lookup },
      },
    });
    await service.onSwapBroadcast(history);
    status.activities[0].needsIconUrls = true;
    await service.resumeRemoteSubscriptions();
    await loaded.promise;
    await service.resumeRemoteSubscriptions();
    expect(readHistory).toHaveBeenCalledTimes(1);
    expect(lookup).toHaveBeenCalledWith({
      networkId: 'evm--1',
      accountId: '',
      tokenInfoOnly: true,
    });
    expect(prefetch).toHaveBeenCalledTimes(1);
    expect(prefetch).toHaveBeenCalledWith({
      activityId: 'synthetic-activity',
      urls: {
        from: history.baseInfo.fromToken.logoURI,
        to: 'https://uni.onekey-asset.com/eth.png',
      },
    });
  });

  it('backs off missing thumbnails even when native prefetch resolves, then stops once the files exist', async () => {
    const history = createHistory();
    history.baseInfo.fromToken.logoURI = 'https://uni.onekey-asset.com/btc.png';
    history.baseInfo.toToken.logoURI = 'https://uni.onekey-asset.com/token.png';
    const readHistory = jest.fn().mockResolvedValue([history]);
    const service = new ServiceLiveActivity({
      backgroundApi: {
        simpleDb: { swapHistory: { getSwapHistoryList: readHistory } },
      },
    });
    const download = deferred<void>();
    const prefetch = jest
      .spyOn(liveActivity, 'prefetchIcons')
      .mockImplementationOnce(() => download.promise)
      .mockResolvedValue(undefined);
    await service.onSwapBroadcast(history);
    status.activities[0].needsIconUrls = true;
    await service.resumeRemoteSubscriptions();
    await jest.advanceTimersByTimeAsync(120_000);
    expect(prefetch).toHaveBeenCalledTimes(1);

    download.resolve();
    await jest.advanceTimersByTimeAsync(0);
    await jest.advanceTimersByTimeAsync(59_999);
    expect(prefetch).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(prefetch).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(119_999);
    expect(prefetch).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(1);
    expect(prefetch).toHaveBeenCalledTimes(3);

    status.activities[0].needsIconUrls = false;
    await jest.advanceTimersByTimeAsync(600_000);
    expect(prefetch).toHaveBeenCalledTimes(3);
    expect(readHistory).toHaveBeenCalledTimes(3);
  });

  it.each([
    [80_007, true],
    [80_010, false],
    [80_012, false],
  ] as const)(
    'uses the polled terminal status only for a definitive Notification rejection (%s)',
    async (code, fallsBack) => {
      serverTransport.subscribe.mockRejectedValueOnce(
        new OneKeyServerApiError({ code, message: 'Mock rejection' }),
      );
      const service = new ServiceLiveActivity({ backgroundApi: {} });
      const history = createHistory('to-btc');
      await service.onSwapBroadcast(history);
      await service.onSwapStatus({
        history,
        status: { state: ESwapTxHistoryStatus.SUCCESS },
      });
      if (fallsBack) {
        expect(liveActivity.update).toHaveBeenCalledWith(
          expect.objectContaining({
            content: expect.objectContaining({ status: 'done' }),
            terminalFallback: {
              activityId: 'synthetic-activity',
              reason: 'subscriptionRejected',
            },
          }),
        );
      } else {
        expect(liveActivity.update).not.toHaveBeenCalled();
      }
    },
  );

  it.each([
    [80_007, false],
    [80_007, true],
    [80_010, false],
    [80_010, true],
  ] as const)(
    'preserves a lost response when a retry returns %s (JS restarted: %s)',
    async (code, restart) => {
      const history = createHistory();
      serverTransport.subscribe
        .mockRejectedValueOnce(new Error('response lost after server commit'))
        .mockRejectedValueOnce(new OneKeyServerApiError({ code }));
      const first = new ServiceLiveActivity({ backgroundApi: {} });
      await first.onSwapBroadcast(history);
      const service = restart
        ? new ServiceLiveActivity({ backgroundApi: {} })
        : first;
      if (restart) await service.resumeRemoteSubscriptions();
      else await jest.advanceTimersByTimeAsync(3000);
      expect(serverTransport.subscribe).toHaveBeenCalledTimes(2);
      await service.onSwapStatus({
        history,
        status: { state: ESwapTxHistoryStatus.SUCCESS },
      });
      expect(liveActivity.update).not.toHaveBeenCalled();
    },
  );

  it('preserves another runtime’s unknown POST when the first validation rejection arrives last', async () => {
    const history = createHistory();
    const firstPost = deferred<ILiveActivitySubscriptionResult>();
    const started = deferred<void>();
    serverTransport.subscribe
      .mockImplementationOnce(() => {
        started.resolve();
        return firstPost.promise;
      })
      .mockRejectedValueOnce(new Error('response lost after server commit'));
    const first = new ServiceLiveActivity({ backgroundApi: {} });
    const broadcast = first.onSwapBroadcast(history);
    await started.promise;
    const restarted = new ServiceLiveActivity({ backgroundApi: {} });
    await restarted.resumeRemoteSubscriptions();
    firstPost.reject(new OneKeyServerApiError({ code: 80_007 }));
    await broadcast;
    await first.onSwapStatus({
      history,
      status: { state: ESwapTxHistoryStatus.SUCCESS },
    });
    expect(serverTransport.subscribe).toHaveBeenCalledTimes(2);
    expect(liveActivity.update).not.toHaveBeenCalled();
  });

  it('continues polling another card when recovering history fails', async () => {
    const history = createHistory();
    const snapshot = buildSwapLiveActivitySnapshot(history);
    if (!snapshot) throw new OneKeyLocalError('Missing snapshot');
    status.activities = [
      {
        ...snapshot,
        activityId: 'one',
        activityState: 'active',
        pushRegistration: 'failed',
      },
      {
        ...snapshot,
        order: {
          ...snapshot.order,
          orderKey: 'swap:other',
          serviceOrderId: 'other',
          depositTxId: 'other-tx',
        },
        activityId: 'two',
        activityState: 'active',
        pushRegistration: 'pending',
      },
    ];
    const getSwapHistoryList = jest
      .fn()
      .mockRejectedValueOnce(new Error('temporarily unavailable'))
      .mockResolvedValue([
        { ...history, status: ESwapTxHistoryStatus.SUCCESS },
      ]);
    const service = new ServiceLiveActivity({
      backgroundApi: { simpleDb: { swapHistory: { getSwapHistoryList } } },
    });
    await service.resumeRemoteSubscriptions();
    status.activities[1].pushRegistration = 'registered';
    await jest.advanceTimersByTimeAsync(3000);
    expect(serverTransport.subscribe).toHaveBeenCalledTimes(1);
    expect(serverTransport.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ activityId: 'two' }),
    );
    expect(liveActivity.update).toHaveBeenCalledWith(
      expect.objectContaining({
        terminalFallback: { activityId: 'one', reason: 'jpushFailed' },
      }),
    );
  });

  it.each([
    [ESwapTxHistoryStatus.EXPIRED, undefined, 'expired'],
    [
      ESwapTxHistoryStatus.FAILED,
      ESwapCrossChainStatus.REFUND_FAILED,
      'refundFailed',
    ],
  ] as const)(
    'recovers %s / %s after failed push setup',
    async (state, crossChainStatus, detail) => {
      const history = createHistory();
      const snapshot = buildSwapLiveActivitySnapshot(history);
      if (!snapshot) throw new OneKeyLocalError('Missing snapshot');
      status.activities = [
        {
          ...snapshot,
          activityId: 'one',
          activityState: 'active',
          pushRegistration: 'failed',
        },
      ];
      const service = new ServiceLiveActivity({
        backgroundApi: {
          simpleDb: {
            swapHistory: {
              getSwapHistoryList: jest
                .fn()
                .mockResolvedValue([
                  { ...history, status: state, crossChainStatus },
                ]),
            },
          },
        },
      });
      await service.resumeRemoteSubscriptions();
      expect(liveActivity.update).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            status: 'failed',
            failureDetail: detail,
          }),
          terminalFallback: { activityId: 'one', reason: 'jpushFailed' },
        }),
      );
    },
  );

  function setupExpiredFallbackAndPendingCard() {
    const history = createHistory();
    const snapshot = buildSwapLiveActivitySnapshot(history);
    if (!snapshot) throw new OneKeyLocalError('Missing snapshot');
    history.status = ESwapTxHistoryStatus.EXPIRED;
    status.activities = [
      {
        ...snapshot,
        activityId: 'one',
        activityState: 'active',
        pushRegistration: 'failed',
      },
      {
        ...snapshot,
        order: {
          ...snapshot.order,
          orderKey: 'swap:other',
          serviceOrderId: 'other',
        },
        activityId: 'two',
        activityState: 'active',
        pushRegistration: 'pending',
      },
    ];
    const fetch = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);
    const service = new ServiceLiveActivity({
      backgroundApi: {
        simpleDb: {
          swapHistory: {
            getSwapHistoryList: jest.fn().mockResolvedValue([history]),
          },
        },
        serviceSwap: { swapHistoryStatusRunFetch: fetch },
      },
    });
    return { history, fetch, service };
  }

  it('accepts a direct refund result after expiry and stops checking', async () => {
    const { history, fetch, service } = setupExpiredFallbackAndPendingCard();
    await service.resumeRemoteSubscriptions();
    await jest.advanceTimersByTimeAsync(60_000);
    expect(fetch).toHaveBeenCalledTimes(1);
    await service.onSwapStatus({
      history,
      status: { state: ESwapTxHistoryStatus.REFUNDED },
    });
    expect(liveActivity.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({ status: 'refunded' }),
        terminalFallback: { activityId: 'one', reason: 'jpushFailed' },
      }),
    );
    await jest.advanceTimersByTimeAsync(60_000);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each([
    [ESwapCrossChainStatus.REFUNDED, 'refunded'],
    [ESwapCrossChainStatus.REFUND_FAILED, 'failed'],
  ] as const)(
    'follows an expired fallback through refunding to %s without a Swap polling owner',
    async (finalStatus, expectedStatus) => {
      const { history, fetch, service } = setupExpiredFallbackAndPendingCard();
      const publish = async (crossChainStatus: ESwapCrossChainStatus) => {
        history.crossChainStatus = crossChainStatus;
        await service.onSwapStatus({
          history,
          status: { state: history.status, crossChainStatus },
        });
      };
      fetch
        .mockImplementationOnce(() => publish(ESwapCrossChainStatus.REFUNDING))
        .mockImplementationOnce(() => publish(finalStatus));

      await service.resumeRemoteSubscriptions();
      expect(status.activities[0].content.failureDetail).toBe('expired');
      await jest.advanceTimersByTimeAsync(59_999);
      expect(fetch).not.toHaveBeenCalled();
      await jest.advanceTimersByTimeAsync(1);
      expect(status.activities[0].content.status).toBe('refunding');
      expect(fetch).toHaveBeenCalledWith(history, {
        shouldScheduleNextFetch: false,
        shouldShowToast: false,
      });
      await service.resumeRemoteSubscriptions();
      await jest.advanceTimersByTimeAsync(59_999);
      expect(fetch).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(1);
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(status.activities[0].content.status).toBe(expectedStatus);
      if (finalStatus === ESwapCrossChainStatus.REFUND_FAILED) {
        expect(status.activities[0].content.failureDetail).toBe('refundFailed');
      }
      await jest.advanceTimersByTimeAsync(120_000);
      expect(fetch).toHaveBeenCalledTimes(2);
    },
  );

  it('subscribes a second card before suspension while the first refund lookup is pending', async () => {
    const { fetch, service } = setupExpiredFallbackAndPendingCard();
    const refund = deferred<void>();
    fetch.mockReturnValue(refund.promise);
    await service.resumeRemoteSubscriptions();
    await jest.advanceTimersByTimeAsync(60_000);
    expect(fetch).toHaveBeenCalledTimes(1);
    // A slow provider spans another reconciliation while JPush is still pending.
    await jest.advanceTimersByTimeAsync(60_000);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(serverTransport.subscribe).not.toHaveBeenCalled();
    status.activities[1].pushRegistration = 'registered';
    await jest.advanceTimersByTimeAsync(3000);
    // From this point a suspended JS runtime cannot run another timer.
    jest.clearAllTimers();
    expect(serverTransport.subscribe).toHaveBeenCalledTimes(1);
    expect(serverTransport.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ activityId: 'two' }),
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    refund.resolve();
  });

  it('stops refund recovery when the fallback activity expires', async () => {
    const { fetch, service } = setupExpiredFallbackAndPendingCard();
    status.activities[0].order.expiresAtMs = Date.now() + 10_000;
    await service.resumeRemoteSubscriptions();
    await jest.advanceTimersByTimeAsync(60_000);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('recovers a terminal order from history after JPush fails and the JS service restarts', async () => {
    const start = jest.mocked(liveActivity.start).getMockImplementation();
    if (!start) throw new OneKeyLocalError('Missing mock');
    jest.mocked(liveActivity.start).mockImplementation(async (request) => {
      const nativeStatus = await start(request);
      nativeStatus.activities[0].pushRegistration = 'pending';
      return nativeStatus;
    });
    const history = createHistory('to-btc');
    const service = new ServiceLiveActivity({ backgroundApi: {} });
    await service.onSwapBroadcast(history);
    await service.onSwapStatus({
      history,
      status: { state: ESwapTxHistoryStatus.SUCCESS },
    });
    expect(liveActivity.update).not.toHaveBeenCalled();
    status.activities[0].pushRegistration = 'failed';
    const readHistory = jest.fn().mockResolvedValue([
      {
        ...history,
        txInfo: { ...history.txInfo, txId: 'provider-deposit-id' },
        status: ESwapTxHistoryStatus.SUCCESS,
      },
    ]);
    const restarted = new ServiceLiveActivity({
      backgroundApi: {
        simpleDb: { swapHistory: { getSwapHistoryList: readHistory } },
      },
    });
    await restarted.resumeRemoteSubscriptions();
    await restarted.resumeRemoteSubscriptions();
    expect(readHistory).toHaveBeenCalledTimes(1);
    expect(liveActivity.update).toHaveBeenCalledWith(
      expect.objectContaining({
        order: expect.objectContaining({ depositTxId: 'deposit-a' }),
        content: expect.objectContaining({ status: 'done' }),
        terminalFallback: {
          activityId: 'synthetic-activity',
          reason: 'jpushFailed',
        },
      }),
    );
    expect(serverTransport.subscribe).not.toHaveBeenCalled();
  });

  it('leaves a previously acknowledged subscription alone after JS restarts', async () => {
    const service = new ServiceLiveActivity({ backgroundApi: {} });
    const history = createHistory('to-btc');
    await service.onSwapBroadcast(history);
    status.activities[0].pushRegistration = 'failed';
    const restarted = new ServiceLiveActivity({ backgroundApi: {} });
    await restarted.onSwapStatus({
      history,
      status: { state: ESwapTxHistoryStatus.SUCCESS },
    });
    expect(liveActivity.update).not.toHaveBeenCalled();
  });

  it('does not take over a card when Notification might have accepted an earlier POST', async () => {
    serverTransport.subscribe.mockRejectedValueOnce(
      new OneKeyLocalError('Mock response lost'),
    );
    const service = new ServiceLiveActivity({ backgroundApi: {} });
    const history = createHistory('to-btc');
    await service.onSwapBroadcast(history);
    expect(serverTransport.subscribe).toHaveBeenCalledTimes(1);
    status.activities[0].pushRegistration = 'failed';
    const restarted = new ServiceLiveActivity({ backgroundApi: {} });
    await restarted.onSwapStatus({
      history,
      status: { state: ESwapTxHistoryStatus.SUCCESS },
    });
    expect(liveActivity.update).not.toHaveBeenCalled();
  });

  it('does not create a real activity before remote tracking is available', async () => {
    jest.mocked(liveActivityRemoteTracking.isReady).mockResolvedValue(false);
    const service = new ServiceLiveActivity({ backgroundApi: {} });
    await service.onSwapBroadcast(createHistory());
    expect(liveActivity.start).not.toHaveBeenCalled();
  });

  it('waits for durable staging before publishing and resolves the staged-only deep link', async () => {
    const stageEntered = deferred<void>();
    const stageGate = deferred<void>();
    const entity = new SimpleDbEntitySwapHistory();
    const stage = entity.stagePendingSwapHistoryItem.bind(entity);
    jest
      .spyOn(entity, 'stagePendingSwapHistoryItem')
      .mockImplementation(async (item) => {
        stageEntered.resolve();
        await stageGate.promise;
        return stage(item);
      });
    jest.spyOn(entity, 'commitPendingSwapHistoryItem').mockResolvedValue(false);
    const liveActivityService = new ServiceLiveActivity({
      backgroundApi: { simpleDb: { swapHistory: entity } },
    });
    const service = new ServiceSwap({
      backgroundApi: {
        serviceNetwork: {
          getNetworksByIds: jest.fn().mockResolvedValue({ networks: [] }),
        },
        serviceLiveActivity: liveActivityService,
        simpleDb: { swapHistory: entity },
      },
    });
    const broadcast = jest.spyOn(liveActivityService, 'onSwapBroadcast');
    const item = createHistory();
    const saving = service.addSwapHistoryItem(item);
    await stageEntered.promise;
    expect(broadcast).not.toHaveBeenCalled();
    stageGate.resolve();
    await expect(saving).resolves.toEqual({ durable: true });
    expect(broadcast).toHaveBeenCalledTimes(1);
    await Promise.all(
      broadcast.mock.results.map(async ({ value }) => {
        await value;
      }),
    );
    expect(await entity.getSwapHistoryList()).toEqual([]);
    const link = { orderKey: 'swap:synthetic-order' };
    await expect(
      liveActivityService.resolveOrderForDeepLink(link),
    ).resolves.toEqual({
      source: 'history',
      history: expect.objectContaining({ txInfo: item.txInfo }),
    });
    await service.cleanSwapHistoryItems([ESwapTxHistoryStatus.PENDING]);
    await expect(
      liveActivityService.resolveOrderForDeepLink(link),
    ).resolves.toBeUndefined();
  });

  it('creates the card only after a retry reaches durable storage', async () => {
    const episode = createHistory();
    const onSwapBroadcast = jest.fn().mockResolvedValue(undefined);
    const stage = jest.fn().mockResolvedValue(false);
    const service = new ServiceSwap({
      backgroundApi: {
        serviceNetwork: {
          getNetworksByIds: jest.fn().mockResolvedValue({ networks: [] }),
        },
        simpleDb: {
          swapHistory: {
            stagePendingSwapHistoryItem: stage,
            addSwapHistoryItem: jest.fn().mockResolvedValue(false),
            commitPendingSwapHistoryItem: jest.fn().mockResolvedValue(true),
          },
        },
        serviceLiveActivity: { onSwapBroadcast },
      },
    });
    await expect(service.addSwapHistoryItem(episode)).resolves.toEqual({
      durable: false,
    });
    expect(onSwapBroadcast).not.toHaveBeenCalled();
    stage.mockResolvedValue(true);
    await jest.advanceTimersToNextTimerAsync();
    expect(onSwapBroadcast).toHaveBeenCalledTimes(1);
    expect(onSwapBroadcast).toHaveBeenCalledWith(
      expect.objectContaining({ txInfo: episode.txInfo }),
    );
  });

  it('updates an existing local-only Bitcoin receiving activity from order polling', async () => {
    const history = createHistory('to-btc');
    const snapshot = buildSwapLiveActivitySnapshot(history);
    if (!snapshot) throw new OneKeyLocalError('Missing activity snapshot');
    await liveActivity.start(snapshot);
    status.activities[0].pushRegistration = 'notRequested';
    const service = new ServiceLiveActivity({ backgroundApi: {} });

    await service.resumeRemoteSubscriptions();
    expect(serverTransport.subscribe).not.toHaveBeenCalled();
    await service.onSwapStatus({
      history,
      status: { state: ESwapTxHistoryStatus.SUCCESS },
    });
    expect(liveActivity.update).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({ status: 'done' }),
      }),
    );
  });

  it('allows privacy cleanup while the subscription POST is still in flight and retries deletion after restart', async () => {
    const pending = deferred<{ status: 'registered'; revision: number }>();
    const started = deferred<void>();
    serverTransport.subscribe.mockImplementationOnce(() => {
      started.resolve();
      return pending.promise;
    });
    jest.spyOn(liveActivity, 'end').mockImplementation(async () => {
      status.activities = [];
      return status;
    });
    const service = new ServiceLiveActivity({ backgroundApi: {} });
    const broadcasting = service.onSwapBroadcast(createHistory());
    await started.promise;
    await service.stopForPrivacyTransition();
    expect(status.activities).toEqual([]);
    expect(liveActivity.clearTracking).toHaveBeenCalledTimes(1);
    expect(serverTransport.unsubscribe).not.toHaveBeenCalled();

    pending.resolve({ status: 'registered', revision: 1 });
    await broadcasting;
    expect((await service.getStatus()).subscriptions).toEqual([]);
    const restarted = new ServiceLiveActivity({ backgroundApi: {} });
    await restarted.resumeRemoteSubscriptions();
    await restarted.resumeRemoteSubscriptions();
    expect(serverTransport.unsubscribe).toHaveBeenCalledTimes(1);
    expect(serverTransport.unsubscribe).toHaveBeenCalledWith(
      expect.objectContaining({ activityId: 'synthetic-activity' }),
    );
  });

  it('ends test cards and deletes their old-node subscription before committing an endpoint change', async () => {
    jest.spyOn(liveActivity, 'end').mockImplementation(async () => {
      status.activities = [];
      return status;
    });
    const service = new ServiceLiveActivity({ backgroundApi: {} });
    await service.onSwapBroadcast(createHistory());
    const update = jest.fn(async () => {
      expect(status.activities).toEqual([]);
      expect(liveActivity.clearTracking).toHaveBeenCalledTimes(1);
      expect(serverTransport.unsubscribe).toHaveBeenCalledTimes(1);
      jest.mocked(liveActivityRemoteTracking.isReady).mockResolvedValue(false);
      return 'production';
    });
    await expect(service.withTestEndpointDisabled(update)).resolves.toBe(
      'production',
    );
    await service.onSwapBroadcast(createHistory());
    expect(liveActivity.start).toHaveBeenCalledTimes(1);
  });

  it('retains an unconfirmed cleanup when a fresh runtime deletes before the old POST settles', async () => {
    const pending = deferred<{ status: 'registered'; revision: number }>();
    const started = deferred<void>();
    serverTransport.subscribe.mockImplementationOnce(() => {
      started.resolve();
      return pending.promise;
    });
    serverTransport.unsubscribe.mockResolvedValueOnce(false);
    jest.spyOn(liveActivity, 'end').mockImplementation(async () => {
      status.activities = [];
      return status;
    });
    const original = new ServiceLiveActivity({ backgroundApi: {} });
    const broadcasting = original.onSwapBroadcast(createHistory());
    await started.promise;
    await original.stopForPrivacyTransition();
    const restarted = new ServiceLiveActivity({ backgroundApi: {} });
    await restarted.resumeRemoteSubscriptions();
    expect(serverTransport.unsubscribe).toHaveBeenCalledTimes(1);
    pending.resolve({ status: 'registered', revision: 1 });
    await broadcasting;
    await jest.advanceTimersByTimeAsync(59_999);
    expect(serverTransport.unsubscribe).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(serverTransport.unsubscribe).toHaveBeenCalledTimes(2);
    await restarted.resumeRemoteSubscriptions();
    expect(serverTransport.unsubscribe).toHaveBeenCalledTimes(2);
  });

  it('schedules a retry when a new runtime cannot delete its only orphaned subscription', async () => {
    jest.spyOn(liveActivity, 'end').mockImplementation(async () => {
      status.activities = [];
      return status;
    });
    const original = new ServiceLiveActivity({ backgroundApi: {} });
    await original.onSwapBroadcast(createHistory());
    await original.stopForPrivacyTransition();
    serverTransport.unsubscribe.mockRejectedValueOnce(new Error('offline'));
    const restarted = new ServiceLiveActivity({ backgroundApi: {} });
    await restarted.resumeRemoteSubscriptions();
    expect(serverTransport.unsubscribe).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(15_000);
    expect(serverTransport.unsubscribe).toHaveBeenCalledTimes(2);
  });

  it('discards a status snapshot from before the endpoint changed', async () => {
    const service = new ServiceLiveActivity({ backgroundApi: {} });
    const start = jest.mocked(liveActivity.start).getMockImplementation();
    if (!start) throw new OneKeyLocalError('Missing mock');
    jest.mocked(liveActivity.start).mockImplementationOnce(async (snapshot) => {
      await start(snapshot);
      status.activities[0].pushRegistration = 'pending';
      return status;
    });
    await service.onSwapBroadcast(createHistory());
    const oldSnapshot = {
      ...status,
      activities: status.activities.map((item) => ({
        ...item,
        pushRegistration: 'registered' as const,
      })),
    };
    const read = deferred<ILiveActivitySystemStatus>();
    const entered = deferred<void>();
    jest.mocked(liveActivity.getStatus).mockImplementationOnce(() => {
      entered.resolve();
      return read.promise;
    });
    jest.spyOn(liveActivity, 'end').mockImplementation(async () => {
      status.activities = [];
      return status;
    });
    const resume = service.resumeRemoteSubscriptions();
    await entered.promise;
    await service.withTestEndpointDisabled(async () => {
      jest.mocked(liveActivityRemoteTracking.isReady).mockResolvedValue(false);
    });
    read.resolve(oldSnapshot);
    await resume;
    expect(serverTransport.subscribe).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'keeps a same-ID order on another network after restart=%s',
    async (restart) => {
      createLocalOnlyActivity();
      const history = createHistory();
      const end = jest.spyOn(liveActivity, 'end').mockResolvedValue(status);
      const service = new ServiceLiveActivity({ backgroundApi: {} });
      await service.onSwapBroadcast(history);
      const current = restart
        ? new ServiceLiveActivity({ backgroundApi: {} })
        : service;
      await current.onSwapDepositReplaced({
        networkId: 'evm--1',
        oldTxId: 'deposit-a',
      });
      await current.onSwapStatus({
        history,
        status: { state: ESwapTxHistoryStatus.PENDING },
      });
      expect(end).not.toHaveBeenCalled();
      expect(liveActivity.update).toHaveBeenCalledTimes(1);
    },
  );

  it('marks legacy activities as needing ownership confirmation after service restart', async () => {
    const first = new ServiceLiveActivity({ backgroundApi: {} });
    await first.onSwapBroadcast(createHistory());
    const restarted = new ServiceLiveActivity({ backgroundApi: {} });
    expect((await restarted.getStatus()).activities[0].ownershipStatus).toBe(
      'needsConfirmation',
    );
    expect(status.activities).toHaveLength(1);
  });

  it('refreshes an existing activity in the App language without changing its business revision', async () => {
    const service = new ServiceLiveActivity({ backgroundApi: {} });
    await service.onSwapBroadcast(createHistory());
    const previous = status.activities[0].content;
    const updateStrings = jest
      .spyOn(liveActivity, 'updateStrings')
      .mockResolvedValue(status);
    appLocale.setLocale('zh-CN', chineseMessages);
    await service.refreshLanguage();
    expect(updateStrings).toHaveBeenCalledWith(
      expect.objectContaining({
        revision: previous.revision,
        strings: expect.objectContaining({ done: '完成' }),
      }),
    );
    expect(liveActivity.update).not.toHaveBeenCalled();
  });

  it('refreshes remote labels even when the push has no timestamp or revision', async () => {
    const service = new ServiceLiveActivity({ backgroundApi: {} });
    await service.onSwapBroadcast(createHistory('to-btc'));
    status.activities[0].content = { status: 'receiving' };
    const updateStrings = jest
      .spyOn(liveActivity, 'updateStrings')
      .mockResolvedValue(status);
    appLocale.setLocale('zh-CN', chineseMessages);
    await service.refreshLanguage();
    expect(updateStrings).toHaveBeenCalledWith(
      expect.objectContaining({
        revision: undefined,
        strings: expect.objectContaining({
          done: '完成',
          lastUpdated: '',
          locale: 'zh-CN',
        }),
      }),
    );
    expect(liveActivity.update).not.toHaveBeenCalled();
  });
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('gives successive status updates distinct revisions in the same millisecond', async () => {
    createLocalOnlyActivity();
    jest.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
    const service = new ServiceLiveActivity({ backgroundApi: {} });
    const history = createHistory();
    await service.onSwapBroadcast(history);
    await service.onSwapStatus({
      history,
      status: { state: ESwapTxHistoryStatus.PENDING },
    });
    await service.onSwapStatus({
      history,
      status: { state: ESwapTxHistoryStatus.PENDING },
    });
    const revisions = jest
      .mocked(liveActivity.update)
      .mock.calls.map(([snapshot]) => snapshot.content.revision);
    expect(revisions[1]).toBeGreaterThan(revisions[0]);
  });

  it('waits for activity creation before publishing a status for the same order', async () => {
    const creation = deferred<ILiveActivitySystemStatus>();
    const started = deferred<void>();
    jest.mocked(liveActivity.start).mockImplementation(async (snapshot) => {
      status.activities = [
        {
          ...snapshot,
          content: buildLiveActivityPushContent(
            snapshot.order,
            snapshot.content,
            Date.now(),
          ),
          activityId: 'synthetic-activity',
          activityState: 'active',
          pushRegistration: 'notRequested',
        },
      ];
      started.resolve();
      return creation.promise;
    });
    const service = new ServiceLiveActivity({ backgroundApi: {} });
    const history = createHistory();
    const broadcast = service.onSwapBroadcast(history);
    await started.promise;
    const update = service.onSwapStatus({
      history,
      status: { state: ESwapTxHistoryStatus.SUCCESS },
    });
    await Promise.resolve();
    expect(liveActivity.update).not.toHaveBeenCalled();
    creation.resolve(status);
    await Promise.all([broadcast, update]);
    expect(liveActivity.update).toHaveBeenCalledTimes(1);
    expect(status.activities[0]?.content.status).toBe('done');
  });

  it('drains an in-flight native update, drops queued old states, and closes the replaced order', async () => {
    createLocalOnlyActivity();
    const service = new ServiceLiveActivity({ backgroundApi: {} });
    const history = createHistory();
    await service.onSwapBroadcast(history);
    const started = deferred<void>();
    const complete = deferred<ILiveActivitySystemStatus>();
    jest.mocked(liveActivity.update).mockImplementationOnce(async () => {
      started.resolve();
      return complete.promise;
    });
    const end = jest.spyOn(liveActivity, 'end').mockImplementation(async () => {
      status.activities = [];
      return status;
    });
    const first = service.onSwapStatus({
      history,
      status: { state: ESwapTxHistoryStatus.SUCCESS },
    });
    await started.promise;
    const second = service.onSwapStatus({
      history,
      status: { state: ESwapTxHistoryStatus.PENDING },
    });
    const third = service.onSwapStatus({
      history,
      status: { state: ESwapTxHistoryStatus.FAILED },
    });
    await Promise.resolve();
    await service.onSwapDepositReplaced({
      networkId: 'btc--0',
      oldTxId: 'deposit-a',
    });
    expect(end).not.toHaveBeenCalled();
    complete.resolve(status);
    await Promise.all([first, second, third]);
    await service.stopForPrivacyTransition();
    expect(liveActivity.update).toHaveBeenCalledTimes(1);
    expect(end).toHaveBeenCalledWith('swap:synthetic-order');
    expect(status.activities).toEqual([]);
  });

  it('invalidates queued updates before a delayed real lazy-service proxy can notify the coordinator', async () => {
    createLocalOnlyActivity();
    const service = new ServiceLiveActivity({ backgroundApi: {} });
    const history = createHistory();
    await service.onSwapBroadcast(history);
    await inAppNotificationAtom.set((pre) => ({
      ...pre,
      swapHistoryPendingList: [],
    }));
    const loader = deferred<ServiceLiveActivity>();
    const proxy = createLazyServiceProxy({
      serviceName: 'ServiceLiveActivity',
      loader: () => loader.promise,
    });
    const swap = new ServiceSwap({
      backgroundApi: { serviceLiveActivity: proxy },
    });
    const started = deferred<void>();
    const complete = deferred<ILiveActivitySystemStatus>();
    jest.mocked(liveActivity.update).mockImplementationOnce(async () => {
      started.resolve();
      return complete.promise;
    });
    const end = jest.spyOn(liveActivity, 'end').mockImplementation(async () => {
      status.activities = [];
      return status;
    });
    const first = service.onSwapStatus({
      history,
      status: { state: ESwapTxHistoryStatus.SUCCESS },
    });
    await started.promise;
    const queued = service.onSwapStatus({
      history,
      status: { state: ESwapTxHistoryStatus.FAILED },
    });
    await Promise.resolve();
    const replacement = swap.updateSwapHistoryTx({
      networkId: 'btc--0',
      oldTxId: 'deposit-a',
      newTxId: 'deposit-b',
      status: ESwapTxHistoryStatus.CANCELING,
    });
    complete.resolve(status);
    await Promise.all([first, queued, replacement]);
    expect(liveActivity.update).toHaveBeenCalledTimes(1);
    expect(end).not.toHaveBeenCalled();
    loader.resolve(service);
    await proxy.onSwapDepositReplaced({
      networkId: 'btc--0',
      oldTxId: 'deposit-a',
    });
    await service.stopForPrivacyTransition();
    expect(end).toHaveBeenCalledWith('swap:synthetic-order');
  });

  it('blocks later replacement generations and cannot recreate the ended activity', async () => {
    const service = new ServiceLiveActivity({ backgroundApi: {} });
    const history = createHistory();
    await service.onSwapBroadcast(history);
    jest.spyOn(liveActivity, 'end').mockImplementation(async () => {
      status.activities = [];
      return status;
    });
    const orderKey = 'swap:synthetic-order';
    await service.onSwapDepositReplaced({
      networkId: 'btc--0',
      oldTxId: 'deposit-a',
      orderKey,
    });
    await service.onSwapDepositReplaced({
      networkId: 'btc--0',
      oldTxId: 'deposit-b',
      orderKey,
    });
    const second = {
      ...history,
      txInfo: { ...history.txInfo, txId: 'deposit-b' },
    };
    const third = {
      ...history,
      txInfo: { ...history.txInfo, txId: 'deposit-c' },
    };
    await service.onSwapStatus({
      history: second,
      status: { state: ESwapTxHistoryStatus.PENDING },
    });
    await service.onSwapBroadcast(third);
    await service.onSwapStatus({
      history: third,
      status: { state: ESwapTxHistoryStatus.SUCCESS },
    });
    await service.stopForPrivacyTransition();
    expect(liveActivity.start).toHaveBeenCalledTimes(1);
    expect(liveActivity.update).not.toHaveBeenCalled();
    expect(liveActivity.end).toHaveBeenCalledTimes(1);
  });

  it('closes an exact deposit match after the background service restarts without history', async () => {
    const oldService = new ServiceLiveActivity({ backgroundApi: {} });
    await oldService.onSwapBroadcast(createHistory());
    const activity = status.activities[0];
    if (!activity) throw new OneKeyLocalError('Expected activity');
    status.activities.push({
      ...activity,
      activityId: 'unrelated-activity',
      order: {
        ...activity.order,
        orderKey: 'swap:other',
        depositTxId: 'other-deposit',
      },
    });
    const ended = deferred<void>();
    const end = jest
      .spyOn(liveActivity, 'end')
      .mockImplementation(async (orderKey) => {
        status.activities = status.activities.filter(
          (item) => item.order.orderKey !== orderKey,
        );
        ended.resolve();
        return status;
      });
    const restartedService = new ServiceLiveActivity({ backgroundApi: {} });
    await restartedService.onSwapDepositReplaced({
      networkId: 'btc--0',
      oldTxId: 'deposit-a',
    });
    await ended.promise;
    expect(end).toHaveBeenCalledWith('swap:synthetic-order');
    expect(status.activities.map((item) => item.order.orderKey)).toEqual([
      'swap:other',
    ]);
  });

  it('does not schedule replacement cleanup after a privacy transition begins', async () => {
    const oldService = new ServiceLiveActivity({ backgroundApi: {} });
    await oldService.onSwapBroadcast(createHistory());
    const previousStatus = { ...status, activities: [...status.activities] };
    const pendingRead = deferred<ILiveActivitySystemStatus>();
    jest
      .mocked(liveActivity.getStatus)
      .mockImplementationOnce(() => pendingRead.promise);
    const end = jest.spyOn(liveActivity, 'end').mockImplementation(async () => {
      status.activities = [];
      return status;
    });
    const restartedService = new ServiceLiveActivity({ backgroundApi: {} });
    const replacing = restartedService.onSwapDepositReplaced({
      networkId: 'btc--0',
      oldTxId: 'deposit-a',
    });
    await restartedService.stopForPrivacyTransition();
    pendingRead.resolve(previousStatus);
    await replacing;
    expect(end).toHaveBeenCalledTimes(1);
    expect(liveActivity.clearTracking).toHaveBeenCalledTimes(1);
  });

  it('propagates failure to clear native tracking during privacy cleanup', async () => {
    jest
      .mocked(liveActivity.clearTracking)
      .mockRejectedValue(new OneKeyLocalError('Native module too old'));
    const service = new ServiceLiveActivity({ backgroundApi: {} });
    await expect(service.stopForPrivacyTransition()).rejects.toThrow(
      'Native module too old',
    );
  });

  it('drains pending creation and prevents new activity during a privacy transition', async () => {
    const creation = deferred<ILiveActivitySystemStatus>();
    const started = deferred<void>();
    const originalStart = jest
      .mocked(liveActivity.start)
      .getMockImplementation();
    jest.mocked(liveActivity.start).mockImplementation(async (snapshot) => {
      if (!originalStart) throw new OneKeyLocalError('Missing mock');
      await originalStart(snapshot);
      started.resolve();
      return creation.promise;
    });
    jest.spyOn(liveActivity, 'end').mockImplementation(async () => {
      status.activities = [];
      return status;
    });
    const service = new ServiceLiveActivity({ backgroundApi: {} });
    const broadcast = service.onSwapBroadcast(createHistory());
    await started.promise;
    const stopping = service.stopForPrivacyTransition();
    await service.onSwapBroadcast(createHistory());
    expect(liveActivity.start).toHaveBeenCalledTimes(1);
    expect(liveActivity.end).not.toHaveBeenCalled();
    creation.resolve(status);
    await Promise.all([broadcast, stopping]);
    expect(liveActivity.end).toHaveBeenCalledTimes(1);
    expect(liveActivity.clearTracking).toHaveBeenCalledTimes(1);
    expect(status.activities).toEqual([]);
  });

  it('does not reject the broadcast owner when native creation fails', async () => {
    jest
      .mocked(liveActivity.start)
      .mockRejectedValue(new OneKeyLocalError('Synthetic native failure'));
    const subscribe = serverTransport.subscribe;
    const service = new ServiceLiveActivity({ backgroundApi: {} });
    await expect(
      service.onSwapBroadcast(createHistory()),
    ).resolves.toBeUndefined();
    expect(subscribe).not.toHaveBeenCalled();
  });

  it('does not subscribe when native Live Activities are disabled', async () => {
    jest
      .mocked(liveActivity.start)
      .mockResolvedValue({ supported: true, enabled: false, activities: [] });
    const subscribe = serverTransport.subscribe;
    const service = new ServiceLiveActivity({ backgroundApi: {} });
    await service.onSwapBroadcast(createHistory());
    expect(subscribe).not.toHaveBeenCalled();
  });

  it.each([
    ['from-btc', 'btc--0'],
    ['to-btc', 'evm--1'],
  ] as const)(
    'waits for the JPush acknowledgement before subscribing (%s)',
    async (direction, depositNetworkId) => {
      const mockStart = jest.mocked(liveActivity.start).getMockImplementation();
      if (!mockStart) throw new OneKeyLocalError('Missing mock');
      jest.mocked(liveActivity.start).mockImplementation(async (snapshot) => {
        await mockStart(snapshot);
        status.activities[0].pushRegistration = 'pending';
        return status;
      });
      const service = new ServiceLiveActivity({ backgroundApi: {} });
      await service.onSwapBroadcast(createHistory(direction));
      expect(serverTransport.subscribe).not.toHaveBeenCalled();
      status.activities[0].pushRegistration = 'registered';
      await jest.advanceTimersByTimeAsync(3000);
      expect(serverTransport.subscribe).toHaveBeenCalledTimes(1);
      expect(serverTransport.subscribe).toHaveBeenCalledWith(
        expect.objectContaining({
          activityId: 'synthetic-activity',
          order: expect.objectContaining({
            serviceOrderId: 'synthetic-order',
            networkId: depositNetworkId,
            depositTxId: 'deposit-a',
          }),
        }),
      );
      await service.resumeRemoteSubscriptions();
      expect(serverTransport.subscribe).toHaveBeenCalledTimes(1);
    },
  );

  it('does not POST again for a replacement hash on an already subscribed order', async () => {
    const service = new ServiceLiveActivity({ backgroundApi: {} });
    const history = createHistory();
    await service.onSwapBroadcast(history);
    await service.onSwapStatus({
      history: {
        ...history,
        txInfo: { ...history.txInfo, txId: 'deposit-b' },
      },
      status: { state: ESwapTxHistoryStatus.PENDING },
    });
    expect(serverTransport.subscribe).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes once when dismissed while registration is in flight', async () => {
    const first = deferred<{ status: 'registered'; revision: number }>();
    const started = deferred<void>();
    serverTransport.subscribe.mockImplementation(() => {
      started.resolve();
      return first.promise;
    });
    const unsubscribe = serverTransport.unsubscribe;
    const service = new ServiceLiveActivity({ backgroundApi: {} });
    const broadcast = service.onSwapBroadcast(createHistory());
    await started.promise;
    status.activities = [];
    first.resolve({ status: 'registered', revision: 1 });
    await broadcast;
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(unsubscribe).toHaveBeenCalledWith({
      activityId: 'synthetic-activity',
      orderKey: 'swap:synthetic-order',
      reason: 'dismissed',
    });
    expect((await service.getStatus()).subscriptions).toEqual([]);
  });

  it('does not POST an expired native activity', async () => {
    const service = new ServiceLiveActivity({ backgroundApi: {} });
    const history = createHistory();
    history.date.created = Date.now() - 9 * 60 * 60 * 1000;
    await service.onSwapBroadcast(history);
    expect(serverTransport.subscribe).not.toHaveBeenCalled();
  });
});
