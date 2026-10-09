import { useEffect, useMemo, useRef, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { ITradingViewNativeTradeMarksComponent } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative';
import type { ITradingViewNativeTradeMark } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative/types';
import { useNetworkRestore } from '@onekeyhq/kit/src/hooks/useNetworkRestore';
import { useActiveTradeInstrumentAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsActiveAccountAtom,
  usePerpsCustomSettingsAtom,
  usePerpsTradesHistoryRefreshHookAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { normalizePerpsAccountAddress } from '@onekeyhq/shared/src/utils/perpsUtils';
import { SPOT_ASSET_ID_OFFSET } from '@onekeyhq/shared/types/hyperliquid/perp.constants';
import type {
  IFill,
  IWsUserFills,
} from '@onekeyhq/shared/types/hyperliquid/sdk';
import {
  EPerpsSubscriptionCategory,
  ESubscriptionType,
} from '@onekeyhq/shared/types/hyperliquid/types';

export function usePerpsNativeChartMarks(): ITradingViewNativeTradeMarksComponent[] {
  const [instrument] = useActiveTradeInstrumentAtom();
  const [account] = usePerpsActiveAccountAtom();
  const [{ showTradeMarks }] = usePerpsCustomSettingsAtom();
  const [{ refreshHook }] = usePerpsTradesHistoryRefreshHookAtom();
  const { restoreNonce } = useNetworkRestore();
  const accountAddress = account?.accountAddress;
  const lastRefresh = useRef({ accountAddress, refreshHook, restoreNonce });
  const spotName =
    instrument.mode === 'spot' ? instrument.universe?.name : undefined;
  const request = useMemo(() => {
    const coins = new Set([instrument.coin]);
    if (instrument.mode === 'spot') {
      if (spotName) coins.add(spotName);
      if (typeof instrument.assetId === 'number') {
        coins.add(`@${instrument.assetId - SPOT_ASSET_ID_OFFSET}`);
      }
    }
    return { accountAddress, coins };
  }, [
    accountAddress,
    instrument.coin,
    instrument.mode,
    instrument.assetId,
    spotName,
  ]);
  const [result, setResult] = useState<{
    request: typeof request;
    marks: ITradingViewNativeTradeMark[];
  }>();

  useEffect(() => {
    const previousRefresh = lastRefresh.current;
    lastRefresh.current = { accountAddress, refreshHook, restoreNonce };
    if (!accountAddress || showTradeMarks === false) return;
    let disposed = false;
    const mergeFills = (fills: IFill[]) => {
      if (disposed) return;
      const marks = fills
        .filter(
          (fill) => request.coins.has(fill.coin) && Number.isFinite(fill.time),
        )
        .map(
          (fill): ITradingViewNativeTradeMark => ({
            id: `${fill.coin}:${fill.tid ?? fill.oid}:${fill.time}`,
            label: fill.side === 'B' ? 'B' : 'S',
            text: `${fill.dir}\n${fill.sz} @ ${fill.px}`,
            time: Math.floor(fill.time / 1000),
          }),
        );
      setResult((previous) => {
        const merged = new Map(
          (previous?.request === request ? previous.marks : []).map((mark) => [
            mark.id,
            mark,
          ]),
        );
        marks.forEach((mark) => merged.set(mark.id, mark));
        return {
          request,
          marks: Array.from(merged.values())
            .toSorted((a, b) => a.time - b.time)
            .slice(-2000),
        };
      });
    };
    const onFills = (
      event: IAppEventBusPayload[EAppEventBusNames.HyperliquidDataUpdate],
    ) => {
      if (
        event.type !== EPerpsSubscriptionCategory.ACCOUNT ||
        event.subType !== ESubscriptionType.USER_FILLS
      )
        return;
      const data = event.data as IWsUserFills;
      if (
        normalizePerpsAccountAddress(data.user) !==
        normalizePerpsAccountAddress(accountAddress)
      )
        return;
      mergeFills(data.fills);
    };
    // Subscribe before loading history so fills arriving during the request survive.
    appEventBus.on(EAppEventBusNames.HyperliquidDataUpdate, onFills);
    const loadHistory = (force: boolean) => {
      void backgroundApiProxy.serviceHyperliquid
        .loadTradesHistory(accountAddress, { force })
        .then(mergeFills)
        .catch(() => {
          // Keep same-account marks; refresh and network recovery can retry history.
        });
    };
    const onRecovery = () => loadHistory(true);
    appEventBus.on(EAppEventBusNames.PerpsWebSocketRecovered, onRecovery);
    loadHistory(
      previousRefresh.accountAddress === accountAddress &&
        (previousRefresh.refreshHook !== refreshHook ||
          previousRefresh.restoreNonce !== restoreNonce),
    );
    return () => {
      disposed = true;
      appEventBus.off(EAppEventBusNames.HyperliquidDataUpdate, onFills);
      appEventBus.off(EAppEventBusNames.PerpsWebSocketRecovered, onRecovery);
    };
  }, [accountAddress, request, showTradeMarks, refreshHook, restoreNonce]);

  return useMemo(() => {
    if (
      !accountAddress ||
      showTradeMarks === false ||
      result?.request !== request ||
      !result.marks.length
    )
      return [];
    return [
      { id: 'perps.fills', type: 'tradeMarks', props: { marks: result.marks } },
    ];
  }, [accountAddress, showTradeMarks, request, result]);
}
