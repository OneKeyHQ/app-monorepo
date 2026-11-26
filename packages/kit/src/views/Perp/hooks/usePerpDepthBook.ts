import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { throttle } from 'lodash';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useL2BookAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import type { IActiveTradeInstrument } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { markPerpsL2BookReceived } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/utils/l2BookUtils';
import type { IPerpsL2BookWithLocalReceivedAt } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/utils/l2BookUtils';
import { usePerpsWebSocketConnectedAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS } from '@onekeyhq/shared/src/consts/perpCache';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IBook } from '@onekeyhq/shared/types/hyperliquid/sdk';
import type { IL2BookOptions } from '@onekeyhq/shared/types/hyperliquid/types';

import {
  getPerpsDepthChartStatus,
  getPerpsL2BookInteractiveRefreshDelayMs,
  hasL2BookSnapshot,
  isL2BookForTarget,
  isPerpsL2BookInteractive,
} from '../utils/l2BookFreshness';
import { PERPS_ORDER_BOOK_MOBILE_VISUAL_FRAME_MS } from '../utils/orderBookVisualScheduler';
import {
  PERPS_DEPTH_BOOK_OPTIONS,
  getDepthBookPriceStep,
  getTrueDepthMidPrice,
} from '../utils/perpDepthBook';

type IDepthSnapshot = IPerpsL2BookWithLocalReceivedAt;

const DEPTH_TAB_GRACE_MS = 60_000;

export function usePerpDepthSubscriptionActive(
  marketKey: string,
  visible: boolean,
  foreground: boolean,
) {
  const [warmMarketKey, setWarmMarketKey] = useState<string>();
  const isWarm = warmMarketKey === marketKey;
  useEffect(() => {
    if (!foreground || (!visible && !isWarm)) {
      setWarmMarketKey(undefined);
      return undefined;
    }
    if (visible) {
      setWarmMarketKey(marketKey);
      return undefined;
    }
    const timer = setTimeout(
      () => setWarmMarketKey(undefined),
      DEPTH_TAB_GRACE_MS,
    );
    return () => clearTimeout(timer);
  }, [foreground, isWarm, marketKey, visible]);
  return foreground && (visible || isWarm);
}

function getTargetKey(coin: string, options?: IL2BookOptions) {
  return JSON.stringify([
    coin,
    options?.nSigFigs ?? null,
    options?.mantissa ?? null,
  ]);
}

function usePublicDepthBook(coin: string, options?: IL2BookOptions) {
  const targetKey = options ? getTargetKey(coin, options) : undefined;
  const nSigFigs = options?.nSigFigs ?? null;
  const mantissa = options?.mantissa ?? null;
  const [state, setState] = useState<{
    key: string;
    book?: IDepthSnapshot;
    status: 'ready' | 'disconnected' | 'error';
  }>();

  useEffect(() => {
    if (!targetKey) return undefined;
    const service = backgroundApiProxy.serviceHyperliquidSubscription;
    const request = { coin, nSigFigs, mantissa };
    let disposed = false;
    let acquired = false;
    let sawUpdate = false;

    const release = () => {
      void service.unsubscribePublicDepthBook(request).catch(() => undefined);
    };
    const publishBook = (book: IBook, receivedAt: number) => {
      if (!hasL2BookSnapshot(book) || !isL2BookForTarget(book, coin, request))
        return;
      setState({
        key: targetKey,
        status: 'ready',
        book: { ...book, localReceivedAt: receivedAt },
      });
    };
    const onUpdate = (
      event: IAppEventBusPayload[EAppEventBusNames.HyperliquidPublicDepthBook],
    ) => {
      if (disposed || getTargetKey(event.coin, event.options) !== targetKey)
        return;
      sawUpdate = true;
      if (event.status === 'ready') {
        publishBook(markPerpsL2BookReceived(event.book), event.receivedAt);
      } else {
        setState((previous) => ({
          key: targetKey,
          status: event.status,
          book: previous?.key === targetKey ? previous.book : undefined,
        }));
      }
    };

    appEventBus.on(EAppEventBusNames.HyperliquidPublicDepthBook, onUpdate);
    void service
      .subscribePublicDepthBook(request)
      .then((snapshot) => {
        acquired = true;
        if (disposed) {
          release();
        } else if (snapshot && !sawUpdate) {
          publishBook(snapshot.book, snapshot.receivedAt);
        }
      })
      .catch(() => {
        if (!disposed) setState({ key: targetKey, status: 'error' });
      });

    return () => {
      disposed = true;
      appEventBus.off(EAppEventBusNames.HyperliquidPublicDepthBook, onUpdate);
      setState((previous) =>
        previous?.key === targetKey ? undefined : previous,
      );
      if (acquired) release();
    };
  }, [coin, mantissa, nSigFigs, targetKey]);

  return state?.key === targetKey ? state : undefined;
}

function isReceivedAfterPause(
  book: IDepthSnapshot | undefined,
  pausedReceiptSequence: number | undefined,
) {
  return (
    pausedReceiptSequence === undefined ||
    (book?.receiptSequence ?? 0) > pausedReceiptSequence
  );
}

export function usePerpDepthBook(
  instrument: IActiveTradeInstrument,
  active: boolean,
  pausedReceiptSequence?: number,
) {
  const { coin, mode } = instrument;
  const [sharedBook] = useL2BookAtom();
  const [marketConnected] = usePerpsWebSocketConnectedAtom();
  const [freshnessRevision, refreshFreshness] = useState(0);
  const [timedOutKey, setTimedOutKey] = useState<string>();
  const [independentCoin, setIndependentCoin] = useState<string>();
  const lastDisplayed = useRef<{
    active: boolean;
    mode: IActiveTradeInstrument['mode'];
    value: { targetKey: string; book: IDepthSnapshot | undefined };
  }>(undefined);
  const shared =
    isL2BookForTarget(sharedBook, coin, PERPS_DEPTH_BOOK_OPTIONS) &&
    hasL2BookSnapshot(sharedBook)
      ? sharedBook
      : undefined;
  const sharedFresh =
    marketConnected &&
    isPerpsL2BookInteractive({
      bookTime: shared?.time,
      bookReceivedAt: shared?.localReceivedAt,
      isCachedSnapshot: shared?.isCachedSnapshot,
    });
  const targetKey = getTargetKey(coin, PERPS_DEPTH_BOOK_OPTIONS);
  const usesSharedSubscription = independentCoin !== coin && sharedFresh;
  const needsIndependent = active && Boolean(coin) && !usesSharedSubscription;
  const independent = usePublicDepthBook(
    coin,
    needsIndependent ? PERPS_DEPTH_BOOK_OPTIONS : undefined,
  );

  useEffect(() => {
    if (needsIndependent) setIndependentCoin(coin);
  }, [coin, needsIndependent]);

  const independentFresh =
    independent?.status === 'ready' &&
    isPerpsL2BookInteractive({
      bookTime: independent.book?.time,
      bookReceivedAt: independent.book?.localReceivedAt,
      isCachedSnapshot: independent.book?.isCachedSnapshot,
    });
  let liveSource: 'independent' | 'shared' | undefined;
  let book: IDepthSnapshot | undefined;
  if (
    independentFresh &&
    isReceivedAfterPause(independent.book, pausedReceiptSequence)
  ) {
    liveSource = 'independent';
    book = independent.book;
  } else if (
    sharedFresh &&
    isReceivedAfterPause(shared, pausedReceiptSequence)
  ) {
    liveSource = 'shared';
    book = shared;
  } else {
    const last = lastDisplayed.current;
    const lastBook =
      active &&
      last?.active &&
      last.mode === mode &&
      last.value.targetKey === targetKey
        ? last.value.book
        : undefined;
    book = lastBook ?? independent?.book ?? shared;
  }
  const { time, localReceivedAt, isCachedSnapshot } = book ?? {};
  useEffect(() => {
    if (!active) return undefined;
    const delay = getPerpsL2BookInteractiveRefreshDelayMs({
      bookTime: time,
      bookReceivedAt: localReceivedAt,
      isCachedSnapshot,
    });
    if (delay === undefined) return undefined;
    const timer = setTimeout(
      () => refreshFreshness((revision) => revision + 1),
      delay,
    );
    return () => clearTimeout(timer);
  }, [active, freshnessRevision, isCachedSnapshot, localReceivedAt, time]);

  const hasBook = Boolean(book);
  useEffect(() => {
    setTimedOutKey(undefined);
    if (!active || hasBook || !coin) return undefined;
    const timer = setTimeout(
      () => setTimedOutKey(targetKey),
      PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS,
    );
    return () => clearTimeout(timer);
  }, [active, coin, hasBook, targetKey, usesSharedSubscription]);

  const independentFailed = independent?.status === 'error';
  const status = getPerpsDepthChartStatus({
    book: book ?? null,
    isConnectionReady: liveSource !== undefined,
    hasLoadFailed: timedOutKey === targetKey || independentFailed,
  });
  // Keep the visual midpoint and levels on the same snapshot. BBO updates
  // independently and can otherwise move the center outside the plotted spread.
  const visualBid = book?.levels[0][0]?.px;
  const visualAsk = book?.levels[1][0]?.px;
  const visualMidPrice = getTrueDepthMidPrice(visualBid, visualAsk);
  const isSpot = mode === 'spot';
  const priceStep = getDepthBookPriceStep({
    price: visualMidPrice ?? Number(visualBid ?? visualAsk),
    szDecimals: isSpot
      ? instrument.universe?.baseSzDecimals
      : instrument.universe?.szDecimals,
    isSpot,
  });
  const referencePriceDecimals = Math.max(
    new BigNumber(visualBid ?? 0).dp() ?? 0,
    new BigNumber(visualAsk ?? 0).dp() ?? 0,
  );
  const latest = useMemo(
    () => ({
      active,
      mode,
      liveSource,
      value: {
        book,
        status,
        independentFailed,
        targetKey,
        referenceMidPrice: visualMidPrice,
        referencePriceDecimals,
        priceStep,
      },
    }),
    [
      active,
      book,
      independentFailed,
      liveSource,
      mode,
      priceStep,
      referencePriceDecimals,
      status,
      targetKey,
      visualMidPrice,
    ],
  );
  const [visualSnapshot, setVisualSnapshot] = useState(latest);
  const publish = useMemo(
    () => throttle(setVisualSnapshot, PERPS_ORDER_BOOK_MOBILE_VISUAL_FRAME_MS),
    [],
  );
  const publishImmediately =
    visualSnapshot.active !== active ||
    visualSnapshot.mode !== mode ||
    visualSnapshot.liveSource !== liveSource ||
    visualSnapshot.value.targetKey !== targetKey ||
    visualSnapshot.value.status !== status ||
    visualSnapshot.value.independentFailed !== independentFailed ||
    (visualSnapshot.value.referenceMidPrice === undefined) !==
      (visualMidPrice === undefined) ||
    (visualSnapshot.value.priceStep === undefined) !==
      (priceStep === undefined);
  const displayed = publishImmediately ? latest : visualSnapshot;
  useLayoutEffect(() => {
    const isFirstDisplay = !lastDisplayed.current;
    // Keep the committed display separate from ticks waiting in the throttle.
    lastDisplayed.current = displayed;
    if (publishImmediately) publish.cancel();
    if (isFirstDisplay || latest !== visualSnapshot) publish(latest);
  }, [displayed, latest, publish, publishImmediately, visualSnapshot]);
  useLayoutEffect(() => () => publish.cancel(), [publish]);
  return displayed.value;
}
