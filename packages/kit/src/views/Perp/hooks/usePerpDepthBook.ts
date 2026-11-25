import { useEffect, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { throttle } from 'lodash';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  useBboForOrderPrice,
  useL2BookAtom,
  usePerpsMidByCoin,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import type { IActiveTradeInstrument } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
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
  getPerpsBboInteractiveRefreshDelayMs,
  getPerpsDepthChartStatus,
  getPerpsL2BookInteractiveRefreshDelayMs,
  hasL2BookSnapshot,
  isL2BookForTarget,
  isPerpsBboInteractive,
  isPerpsL2BookInteractive,
} from '../utils/l2BookFreshness';
import { PERPS_ORDER_BOOK_MOBILE_VISUAL_FRAME_MS } from '../utils/orderBookVisualScheduler';
import {
  getDepthBookPriceStep,
  getDepthBookTarget,
  getTrueDepthMidPrice,
} from '../utils/perpDepthBook';

import type { IDepthBookTarget } from '../utils/perpDepthBook';

type IDepthSnapshot = IBook & {
  localReceivedAt?: number;
  isCachedSnapshot?: boolean;
};

const RAW_BOOK_OPTIONS = { nSigFigs: null, mantissa: null };
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
        publishBook(event.book, event.receivedAt);
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

export function usePerpDepthBook(
  instrument: IActiveTradeInstrument,
  active: boolean,
) {
  const { coin, mode } = instrument;
  const [sharedBook] = useL2BookAtom();
  const bbo = useBboForOrderPrice(active);
  const [marketConnected] = usePerpsWebSocketConnectedAtom();
  const marketMid = usePerpsMidByCoin(coin);
  const [freshnessRevision, refreshFreshness] = useState(0);
  const [target, setTarget] = useState<IDepthBookTarget>();
  const [timedOutKey, setTimedOutKey] = useState<string>();
  const [independentTargetKey, setIndependentTargetKey] = useState<string>();
  const shared =
    sharedBook?.coin === coin && hasL2BookSnapshot(sharedBook)
      ? sharedBook
      : undefined;
  const raw = isL2BookForTarget(shared, coin, RAW_BOOK_OPTIONS)
    ? shared
    : undefined;
  const sharedFresh =
    marketConnected &&
    isPerpsL2BookInteractive({
      bookTime: shared?.time,
      bookReceivedAt: shared?.localReceivedAt,
      isCachedSnapshot: shared?.isCachedSnapshot,
    });
  const matchingBbo = bbo?.coin === coin ? bbo : undefined;
  const bboFresh =
    marketConnected &&
    isPerpsBboInteractive({
      bboTime: matchingBbo?.time,
      bboReceivedAt: matchingBbo?.localReceivedAt,
    });
  const bboBid = bboFresh ? matchingBbo?.bbo[0]?.px : undefined;
  const bboAsk = bboFresh ? matchingBbo?.bbo[1]?.px : undefined;
  const rawBid = sharedFresh ? raw?.levels[0][0]?.px : undefined;
  const rawAsk = sharedFresh ? raw?.levels[1][0]?.px : undefined;
  const bboMid = getTrueDepthMidPrice(bboBid, bboAsk);
  const referenceMidPrice = bboMid ?? getTrueDepthMidPrice(rawBid, rawAsk);
  const price =
    referenceMidPrice ??
    Number(marketMid ?? shared?.levels[0][0]?.px ?? shared?.levels[1][0]?.px);
  const isSpot = mode === 'spot';
  const szDecimals = isSpot
    ? instrument.universe?.baseSzDecimals
    : instrument.universe?.szDecimals;
  const planInput = { price, szDecimals, isSpot };
  const initialTarget = getDepthBookTarget(planInput);
  const activeTarget = target ?? initialTarget;
  const targetKey = getTargetKey(coin, activeTarget?.options);
  const sharedMatches = Boolean(
    activeTarget && isL2BookForTarget(shared, coin, activeTarget.options),
  );
  const usesShared =
    sharedMatches && sharedFresh && independentTargetKey !== targetKey;
  const needsIndependent =
    active && Boolean(coin && activeTarget) && !usesShared;
  const independent = usePublicDepthBook(
    coin,
    needsIndependent ? activeTarget?.options : undefined,
  );

  useEffect(() => {
    if (needsIndependent) setIndependentTargetKey(targetKey);
  }, [needsIndependent, targetKey]);

  useEffect(() => {
    if (!target && initialTarget) setTarget(initialTarget);
  }, [initialTarget, target]);

  const knownEmpty =
    sharedFresh &&
    shared &&
    !shared.levels[0].length &&
    !shared.levels[1].length
      ? shared
      : undefined;
  const book = usesShared
    ? shared
    : (independent?.book ??
      (sharedMatches ? shared : undefined) ??
      (!activeTarget ? knownEmpty : undefined));
  const sourceConnected =
    usesShared || !activeTarget
      ? marketConnected
      : independent?.status === 'ready';
  const { time, localReceivedAt, isCachedSnapshot } = book ?? {};
  const { time: bboTime, localReceivedAt: bboReceivedAt } = matchingBbo ?? {};
  useEffect(() => {
    if (!active) return undefined;
    const delay = Math.min(
      getPerpsL2BookInteractiveRefreshDelayMs({
        bookTime: time,
        bookReceivedAt: localReceivedAt,
        isCachedSnapshot,
      }) ?? Infinity,
      getPerpsBboInteractiveRefreshDelayMs({ bboTime, bboReceivedAt }) ??
        Infinity,
    );
    if (!Number.isFinite(delay)) return undefined;
    const timer = setTimeout(
      () => refreshFreshness((revision) => revision + 1),
      delay,
    );
    return () => clearTimeout(timer);
  }, [
    active,
    bboReceivedAt,
    bboTime,
    freshnessRevision,
    isCachedSnapshot,
    localReceivedAt,
    time,
  ]);

  const hasBook = Boolean(book);
  useEffect(() => {
    setTimedOutKey(undefined);
    if (!active || hasBook || !coin) return undefined;
    const timer = setTimeout(
      () => setTimedOutKey(targetKey),
      PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS,
    );
    return () => clearTimeout(timer);
  }, [active, coin, hasBook, targetKey, usesShared]);

  const status = getPerpsDepthChartStatus({
    book: book ?? null,
    isConnectionReady: sourceConnected,
    hasLoadFailed: timedOutKey === targetKey || independent?.status === 'error',
  });
  const liveStep = activeTarget
    ? getDepthBookPriceStep(planInput, activeTarget.options)
    : undefined;
  const priceStep =
    liveStep !== undefined && Number.isFinite(liveStep)
      ? liveStep
      : activeTarget?.step;
  // Keep the visual midpoint and levels on the same snapshot. BBO updates
  // independently and can otherwise move the center outside the plotted spread.
  const visualBid = book?.levels[0][0]?.px;
  const visualAsk = book?.levels[1][0]?.px;
  const visualMidPrice = getTrueDepthMidPrice(visualBid, visualAsk);
  const referencePriceDecimals = Math.max(
    new BigNumber(visualBid ?? 0).dp() ?? 0,
    new BigNumber(visualAsk ?? 0).dp() ?? 0,
  );
  const latest = useMemo(
    () => ({
      book,
      status,
      targetKey,
      referenceMidPrice: visualMidPrice,
      referencePriceDecimals,
      priceStep,
    }),
    [
      book,
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
  useEffect(() => {
    publish(latest);
  }, [latest, publish]);
  useEffect(() => () => publish.cancel(), [publish]);
  if (
    visualSnapshot.targetKey !== targetKey ||
    visualSnapshot.status !== status ||
    (visualSnapshot.referenceMidPrice === undefined) !==
      (visualMidPrice === undefined)
  ) {
    return latest;
  }
  return visualSnapshot;
}
