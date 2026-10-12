import { useCallback, useEffect, useRef, useState } from 'react';

import { generateSwapHistoryItemForContext } from '@onekeyhq/kit/src/views/Swap/hooks/useSwapTxHistory';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type {
  IDustSweepNetwork,
  IDustSweepReason,
  IDustSweepSnapshot,
} from '@onekeyhq/shared/types/swap/dustSweep';

import {
  dustSweepReducer,
  getDustSweepTotals,
  initialDustSweepState,
} from '../stateMachine';
import {
  DustSweepPaused,
  DustSweepRetryableError,
  DustSweepUnknownSubmission,
  DustSweepUserCanceled,
  executeDustSweepItem,
} from '../utils/execution';
import { DustSweepSkip } from '../utils/quote';

let sessionSequence = 0;

export function useDustSweepSession(networks: IDustSweepNetwork[]) {
  const [state, setState] = useState(initialDustSweepState);
  const stateRef = useRef(state);
  const mounted = useRef(true);
  const controller = useRef<AbortController | undefined>(undefined);
  const running = useRef<Promise<void> | undefined>(undefined);
  const pauseRevision = useRef(0);
  const started = useRef(0);
  const reported = useRef(false);
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
        failedCount: totals.failedCount,
        receiptAvailable: !totals.receiptUnavailable,
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
        const attemptRevision = pauseRevision.current;
        send({ ...identity, status: 'preparing' });
        try {
          const result = await executeDustSweepItem({
            snapshot,
            token: item.token,
            signal,
            pendingApprovalTxIds: item.approvalTxIds,
            shouldContinue: () =>
              pauseRevision.current === attemptRevision &&
              stateRef.current.phase === 'running' &&
              stateRef.current.snapshot?.id === snapshot.id,
            onSigning: () => send({ ...identity, status: 'signing' }),
            onPrepared: () => send({ ...identity, status: 'preparing' }),
            onApprovalBroadcast: (approvalTxIds) =>
              send({
                type: 'approvalBroadcast',
                sessionId: identity.sessionId,
                key: identity.key,
                approvalTxIds,
              }),
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
            status: result.status,
            reason: result.status === 'failed' ? 'txFailed' : '',
          });
        } catch (error) {
          if (error instanceof DustSweepUnknownSubmission) {
            send({ ...identity, status: 'unknown', reason: 'unknown' });
            break;
          }
          if (signal.aborted) break;
          if (error instanceof DustSweepPaused) {
            send({ ...identity, status: 'waiting' });
            break;
          }
          if (
            error instanceof DustSweepUserCanceled ||
            error instanceof DustSweepRetryableError
          ) {
            send({
              ...identity,
              status: 'waiting',
              reason:
                error instanceof DustSweepRetryableError
                  ? 'unknown'
                  : undefined,
              message:
                error instanceof DustSweepRetryableError
                  ? error.message
                  : undefined,
            });
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
            status: 'skipped',
            reason,
          });
        }
      }
      if (stateRef.current.phase === 'completed') reportResult('completed');
    };
    const ownedTask = task().finally(() => {
      if (running.current !== ownedTask) return;
      running.current = undefined;
      // A resume arriving before this worker releases ownership must still run.
      if (
        !signal.aborted &&
        stateRef.current.phase === 'running' &&
        stateRef.current.items.some((item) => item.status === 'waiting')
      )
        run();
    });
    running.current = ownedTask;
  }, [networks, reportResult, send]);

  const start = useCallback(
    (
      input: IDustSweepSnapshot,
      unavailable?: Record<string, IDustSweepReason>,
    ) => {
      if (
        !mounted.current ||
        stateRef.current.phase !== 'selecting' ||
        running.current ||
        !input.tokens.some((token) => !unavailable?.[token.key])
      )
        return;
      sessionSequence += 1;
      const snapshot = { ...input, id: `${input.id}:${sessionSequence}` };
      controller.current = new AbortController();
      started.current = Date.now();
      reported.current = false;
      send({ type: 'start', snapshot, unavailable });
      defaultLogger.dex.dustSweep.dustSweepStart({
        network: snapshot.networkId,
        tokenCount: snapshot.tokens.length,
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
    if (stateRef.current.phase !== 'running') return;
    // Invalidate preparation even if Continue arrives before it finishes.
    pauseRevision.current += 1;
    send({ type: 'pause' });
  }, [send]);
  const reset = useCallback(() => {
    send({ type: 'reset' });
  }, [send]);
  const leave = useCallback(async () => {
    const alreadyUnknown = stateRef.current.items.some(
      (item) => item.status === 'unknown',
    );
    send({ type: 'leave' });
    controller.current?.abort();
    // A password/signing call already entered in background is not cancellable.
    // Keep this page alive until it returns; no later operation may start.
    await running.current;
    if (
      !alreadyUnknown &&
      stateRef.current.items.some((item) => item.status === 'unknown')
    ) {
      send({ type: 'leaveBlocked' });
      return false;
    }
    reportResult('left');
    send({ type: 'left' });
    return true;
  }, [reportResult, send]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      send({ type: 'leave' });
      controller.current?.abort();
      reportResult('left');
    };
  }, [reportResult, send]);

  return {
    state,
    start,
    pause,
    resume,
    reset,
    leave,
    leaving: state.phase === 'leaving',
  };
}
