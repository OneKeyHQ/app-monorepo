import { useCallback, useEffect, useRef, useState } from 'react';

import type { IWsTrades } from '@onekeyhq/shared/types/hyperliquid/sdk';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { watchHyperliquidPublicTrades } from '../../../utils/watchHyperliquidPublicTrades';

const LATEST_TRADE_INTERACTIVE_MAX_AGE_MS = 30_000;
type ILatestTrade = IWsTrades[number];
type ILatestTradeSnapshot = {
  coin: string;
  trade: ILatestTrade;
  receivedAt: number;
  isLive: boolean;
};

function isLaterTrade(candidate: ILatestTrade, current: ILatestTrade) {
  return (
    candidate.time > current.time ||
    (candidate.time === current.time && candidate.tid > current.tid)
  );
}

function selectLatestTrade(trades: IWsTrades, coin: string) {
  return trades.reduce<ILatestTrade | undefined>((latest, trade) => {
    if (
      trade.coin !== coin ||
      !Number.isFinite(trade.time) ||
      !Number.isFinite(trade.tid) ||
      !Number.isFinite(Number(trade.px)) ||
      Number(trade.px) <= 0 ||
      (trade.side !== 'A' && trade.side !== 'B')
    ) {
      return latest;
    }
    return !latest || isLaterTrade(trade, latest) ? trade : latest;
  }, undefined);
}

export function usePerpLatestTrade(coin: string, active: boolean) {
  const [snapshot, setSnapshot] = useState<ILatestTradeSnapshot>();
  const latestRef = useRef<ILatestTrade | undefined>(undefined);

  useEffect(() => {
    // A modal pauses the feed, but the same market can retain its display value.
    setSnapshot((previous) =>
      previous?.coin === coin ? { ...previous, isLive: false } : undefined,
    );
    if (latestRef.current?.coin !== coin) latestRef.current = undefined;
    if (!active || !coin) return;
    let disposed = false;
    let connected = false;
    let latest = latestRef.current;
    let expiryTimer: ReturnType<typeof setTimeout> | undefined;
    const invalidate = () => {
      clearTimeout(expiryTimer);
      setSnapshot((previous) =>
        previous?.isLive ? { ...previous, isLive: false } : previous,
      );
    };
    const publish = (trades: IWsTrades, fromSocket: boolean) => {
      if (disposed) return;
      const candidate = selectLatestTrade(trades, coin);
      if (!candidate || (latest && isLaterTrade(latest, candidate))) return;
      // A late HTTP response must not replace or invalidate a live snapshot.
      if (!fromSocket && latest && !isLaterTrade(candidate, latest)) return;
      latest = candidate;
      latestRef.current = candidate;
      clearTimeout(expiryTimer);
      setSnapshot({
        coin,
        trade: candidate,
        receivedAt: Date.now(),
        isLive: fromSocket && connected,
      });
      expiryTimer = setTimeout(invalidate, LATEST_TRADE_INTERACTIVE_MAX_AGE_MS);
    };
    const unwatch = watchHyperliquidPublicTrades({
      coin,
      limit: 1,
      onTrades: (trades) => publish(trades, true),
      onStatus: (status) => {
        if (disposed) return;
        connected = status === 'connected';
        if (!connected) invalidate();
      },
    });
    if (!latest) {
      // Seed only the display while the first websocket batch is pending.
      void backgroundApiProxy.serviceHyperliquid
        .getPerpRecentTrades({ coin })
        .then((trades) => publish(trades, false))
        .catch(() => {
          // The live subscription can still recover when the snapshot fails.
        });
    }
    return () => {
      disposed = true;
      clearTimeout(expiryTimer);
      unwatch();
    };
  }, [coin, active]);

  const current = snapshot?.coin === coin ? snapshot : undefined;
  // Recheck at press time as a timer can be delayed while the JS thread is busy.
  const getSelectablePrice = useCallback(() => {
    if (
      !active ||
      !current?.isLive ||
      Date.now() - current.receivedAt >= LATEST_TRADE_INTERACTIVE_MAX_AGE_MS
    ) {
      return undefined;
    }
    return current.trade.px;
  }, [active, current]);

  return {
    trade: current?.trade,
    isInteractive: active && !!current?.isLive,
    getSelectablePrice,
  };
}
