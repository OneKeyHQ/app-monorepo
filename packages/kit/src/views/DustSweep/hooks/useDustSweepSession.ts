import { useCallback, useEffect, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';

import { generateSwapHistoryItemForContext } from '@onekeyhq/kit/src/views/Swap/hooks/useSwapTxHistory';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type {
  IDustSweepNetwork,
  IDustSweepSnapshot,
} from '@onekeyhq/shared/types/swap/dustSweep';

import {
  dustSweepReducer,
  getDustSweepTotals,
  initialDustSweepState,
} from '../stateMachine';
import {
  DustSweepUnknownSubmission,
  DustSweepUserCanceled,
  executeDustSweepItem,
} from '../utils/execution';
import { DustSweepSkip } from '../utils/quote';

export function useDustSweepSession(networks: IDustSweepNetwork[]) {
  const [state, setState] = useState(initialDustSweepState);
  const stateRef = useRef(state);
  const mounted = useRef(true);
  const controller = useRef<AbortController | undefined>(undefined);
  const running = useRef<Promise<void> | undefined>(undefined);
  const started = useRef(0);
  const reported = useRef(false);
  const [leaving, setLeaving] = useState(false);
  const send = useCallback((action: Parameters<typeof dustSweepReducer>[1]) => {
    stateRef.current = dustSweepReducer(stateRef.current, action);
    if (mounted.current) setState(stateRef.current);
  }, []);
  const reportResult = useCallback(
    (endReason: 'completed' | 'stopped' | 'left') => {
      const current = stateRef.current;
      if (!current.snapshot || reported.current) return;
      reported.current = true;
      const totals = getDustSweepTotals(current.items);
      defaultLogger.dex.dustSweep.dustSweepResult({
        network: current.snapshot.networkId,
        totalCount: current.items.length,
        successCount: totals.successCount,
        skippedCount: totals.skippedCount,
        receivedAmount: totals.receiptUnavailable ? '' : totals.receivedAmount,
        receivedUsd:
          totals.receiptUnavailable || !current.snapshot.nativeToken.price
            ? ''
            : new BigNumber(totals.receivedAmount)
                .times(current.snapshot.nativeToken.price ?? 0)
                .toFixed(),
        durationSec: Math.floor((Date.now() - started.current) / 1000),
        endReason,
      });
    },
    [],
  );

  const run = useCallback(() => {
    if (running.current) return;
    const snapshot = stateRef.current.snapshot;
    const signal = controller.current?.signal;
    if (!snapshot || !signal || signal.aborted) return;
    const task = async () => {
      while (!signal.aborted && stateRef.current.phase === 'running') {
        const item = stateRef.current.items.find(
          (entry) => entry.status === 'waiting',
        );
        if (!item) break;
        const identity = {
          type: 'item' as const,
          sessionId: snapshot.id,
          key: item.token.key,
        };
        send({ ...identity, status: 'preparing' });
        try {
          const result = await executeDustSweepItem({
            snapshot,
            token: item.token,
            signal,
            onSigning: () => send({ ...identity, status: 'signing' }),
            onPrepared: () => send({ ...identity, status: 'preparing' }),
            onBroadcast: (txId) =>
              send({ ...identity, status: 'broadcasted', txId }),
            generateSwapHistoryItem: (params) =>
              generateSwapHistoryItemForContext(params, {
                swapNetworks: networks.map((entry) => entry.network),
                currencyInfo: { id: 'usd', symbol: '$' },
              }),
          });
          if (signal.aborted) break;
          send({
            ...identity,
            status: result.status,
            receivedAmount:
              result.status === 'success' ? result.receivedAmount : undefined,
            receiptUnavailable:
              result.status === 'success'
                ? result.receiptUnavailable
                : undefined,
            reason: result.status === 'failed' ? 'txFailed' : undefined,
            message: result.status === 'failed' ? result.message : undefined,
          });
          defaultLogger.dex.dustSweep.dustSweepItemResult({
            network: snapshot.networkId,
            tokenSymbol: item.token.symbol,
            tokenValueUsd: item.token.valueUsd,
            status: result.status,
            reason: result.status === 'failed' ? 'txFailed' : '',
          });
        } catch (error) {
          if (signal.aborted) break;
          if (error instanceof DustSweepUserCanceled) {
            send({ ...identity, status: 'waiting' });
            send({ type: 'paused' });
            break;
          }
          if (error instanceof DustSweepUnknownSubmission) {
            send({ ...identity, status: 'unknown', reason: 'unknown' });
            send({ type: 'paused' });
            break;
          }
          const reason =
            error instanceof DustSweepSkip ? error.reason : 'unknown';
          send({
            ...identity,
            status: 'skipped',
            reason,
            message: error instanceof Error ? error.message : undefined,
          });
          defaultLogger.dex.dustSweep.dustSweepItemResult({
            network: snapshot.networkId,
            tokenSymbol: item.token.symbol,
            tokenValueUsd: item.token.valueUsd,
            status: 'skipped',
            reason,
          });
        }
        if ((stateRef.current as typeof state).phase === 'pausing')
          send({ type: 'paused' });
      }
      if (stateRef.current.phase === 'completed') reportResult('completed');
    };
    running.current = task().finally(() => {
      running.current = undefined;
    });
  }, [networks, reportResult, send]);

  const start = useCallback(
    (snapshot: IDustSweepSnapshot) => {
      if (stateRef.current.phase !== 'selecting') return;
      controller.current = new AbortController();
      started.current = Date.now();
      reported.current = false;
      send({ type: 'start', snapshot });
      defaultLogger.dex.dustSweep.dustSweepStart({
        network: snapshot.networkId,
        tokenCount: snapshot.tokens.length,
        totalUsd: snapshot.tokens
          .reduce((sum, token) => sum.plus(token.valueUsd), new BigNumber(0))
          .toFixed(),
        slippage: snapshot.slippage,
      });
      defaultLogger.dex.dustSweep.dustSweepPageVisited({
        page: 'progress',
        tokenCount: snapshot.tokens.length,
        hiddenTokenCount: 0,
      });
      run();
    },
    [run, send],
  );

  const resume = useCallback(() => {
    send({ type: 'resume' });
    run();
  }, [run, send]);
  const pause = useCallback(() => {
    send({ type: 'pause' });
  }, [send]);
  const reset = useCallback(() => {
    send({ type: 'reset' });
  }, [send]);
  const leave = useCallback(async () => {
    setLeaving(true);
    const paused = stateRef.current.phase === 'paused';
    controller.current?.abort();
    // A password/signing call already entered in background is not cancellable.
    // Keep this page alive until it returns; no later operation may start.
    await running.current;
    reportResult(paused ? 'stopped' : 'left');
    if (mounted.current) setLeaving(false);
  }, [reportResult]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
      reportResult('left');
    };
  }, [reportResult]);

  return { state, start, pause, resume, reset, leave, leaving };
}
