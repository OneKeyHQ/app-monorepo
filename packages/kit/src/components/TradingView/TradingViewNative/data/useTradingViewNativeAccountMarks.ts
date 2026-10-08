import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ESwapTxHistoryStatus } from '@onekeyhq/shared/types/swap/types';

import { fetchAccountTransactionMarks } from '../../utils/accountTransactionMarks';

import {
  fetchLocalAccountTransactionMarks,
  mergeAccountTransactionMarks,
  normalizeAccountTransactionAddress,
} from './localAccountTransactionMarks';

import type { IAccountTransactionMark } from '../../utils/accountTransactionMarks';
import type {
  ITradingViewNativeAccountMarksContext,
  ITradingViewNativeTradeMarksComponent,
} from '../types';

const EMPTY_COMPONENTS: readonly ITradingViewNativeTradeMarksComponent[] = [];
const REFRESH_DELAYS_MS = [1000, 3000, 10_000];

export function useTradingViewNativeAccountMarks({
  context,
  from,
  to,
}: {
  context?: ITradingViewNativeAccountMarksContext;
  from?: number;
  to?: number;
}): readonly ITradingViewNativeTradeMarksComponent[] {
  const accountAddress = context?.accountAddress;
  const networkId = context?.networkId;
  const tokenAddress = context?.tokenAddress;
  const request = useMemo(
    () => ({ accountAddress, networkId, tokenAddress }),
    [accountAddress, networkId, tokenAddress],
  );
  const [result, setResult] = useState<{
    request: typeof request;
    localMarks: IAccountTransactionMark[];
    serverMarks: IAccountTransactionMark[];
  }>();

  const rangeRef = useRef({ from, to });
  const refreshRef = useRef<(() => void) | null>(null);
  useLayoutEffect(() => {
    rangeRef.current = { from, to };
  }, [from, to]);

  useEffect(() => {
    if (!accountAddress || !networkId || tokenAddress === undefined) {
      return;
    }

    let disposed = false;
    let revision = 0;
    let refreshTimers: ReturnType<typeof setTimeout>[] = [];
    const refreshMarks = async () => {
      const range = rangeRef.current;
      if (range.from === undefined || range.to === undefined) {
        return;
      }
      revision += 1;
      const currentRevision = revision;
      const params = {
        accountAddress,
        networkId,
        tokenAddress,
        from: range.from,
        // The container already includes the latest candle's full interval.
        to: range.to,
      };
      const loadMarks = async (
        source: 'localMarks' | 'serverMarks',
        fetchMarks: () => Promise<IAccountTransactionMark[]>,
      ) => {
        try {
          const marks = await fetchMarks();
          if (!disposed && revision === currentRevision) {
            setResult((previous) => ({
              ...(previous?.request === request
                ? previous
                : { request, localMarks: [], serverMarks: [] }),
              [source]: marks,
            }));
          }
        } catch {
          // Keep the last successful marks; a later refresh can recover.
        }
      };
      // Publish local confirmations without waiting for the server's transaction index.
      await Promise.all([
        loadMarks('localMarks', () =>
          fetchLocalAccountTransactionMarks(params),
        ),
        loadMarks('serverMarks', () => fetchAccountTransactionMarks(params)),
      ]);
    };
    refreshRef.current = () => {
      void refreshMarks();
    };
    const handleSwapSuccess = (
      payload: IAppEventBusPayload[EAppEventBusNames.SwapTxHistoryStatusUpdate],
    ) => {
      if (
        payload.status !== ESwapTxHistoryStatus.SUCCESS &&
        payload.status !== ESwapTxHistoryStatus.PARTIALLY_FILLED
      ) {
        return;
      }
      const matchesToken = [payload.fromToken, payload.toToken].some(
        (
          token:
            | { networkId: string; contractAddress?: string; address?: string }
            | undefined,
        ) =>
          token?.networkId === networkId &&
          normalizeAccountTransactionAddress(
            token.contractAddress || token.address || '',
          ) === normalizeAccountTransactionAddress(tokenAddress),
      );
      if (!matchesToken) {
        return;
      }
      refreshTimers.forEach(clearTimeout);
      void refreshMarks();
      // The account transaction index can lag behind swap confirmation.
      refreshTimers = REFRESH_DELAYS_MS.map((delay) =>
        setTimeout(() => void refreshMarks(), delay),
      );
    };

    appEventBus.on(
      EAppEventBusNames.SwapTxHistoryStatusUpdate,
      handleSwapSuccess,
    );
    return () => {
      disposed = true;
      refreshRef.current = null;
      refreshTimers.forEach(clearTimeout);
      appEventBus.off(
        EAppEventBusNames.SwapTxHistoryStatusUpdate,
        handleSwapSuccess,
      );
    };
  }, [accountAddress, networkId, tokenAddress, request]);

  useEffect(() => {
    // Range changes refresh data without canceling post-confirmation retries.
    refreshRef.current?.();
  }, [request, from, to]);

  return useMemo(() => {
    // Also hide old marks during render, before the previous effect is cleaned up.
    if (result?.request !== request || from === undefined || to === undefined) {
      return EMPTY_COMPONENTS;
    }
    const marks = mergeAccountTransactionMarks({ ...result, from, to });
    if (!marks.length) {
      return EMPTY_COMPONENTS;
    }
    return [
      {
        id: 'system.accountTradeMarks',
        type: 'tradeMarks',
        props: { marks },
      },
    ];
  }, [from, to, request, result]);
}
