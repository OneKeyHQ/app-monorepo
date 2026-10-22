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
  DustSweepPaused,
  DustSweepRetryableError,
  DustSweepUnknownSubmission,
  DustSweepUserCanceled,
  executeDustSweepItem,
} from '../utils/execution';
import { DustSweepSkip } from '../utils/quote';

import type { IDustSweepState } from '../stateMachine';

let sessionSequence = 0;

// A sweep that settles instantly (e.g. one token with no quote) reads as if
// nothing was submitted, so the final result waits until this has passed.
export const DUST_SWEEP_MIN_RUN_MS = 1500;

export function useDustSweepSession(
  networks: IDustSweepNetwork[],
  { minRunMs = DUST_SWEEP_MIN_RUN_MS }: { minRunMs?: number } = {},
) {
  const [state, setState] = useState(initialDustSweepState);
  const stateRef = useRef(state);
  const mounted = useRef(true);
  const controller = useRef<AbortController | undefined>(undefined);
  const running = useRef<Promise<void> | undefined>(undefined);
  const pauseRevision = useRef(0);
  const started = useRef(0);
  const reported = useRef(false);
  const releaseHold = useRef<(() => void) | undefined>(undefined);
  const stoppingRef = useRef(false);
  const [stopping, setStopping] = useState(false);
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
      // A missing receipt or an unsettled submission has no known final amount.
      const receiptAvailable =
        !totals.receiptUnavailable &&
        !current.items.some((item) =>
          ['broadcasted', 'unknown'].includes(item.status),
        );
      const receivedAmount = receiptAvailable
        ? new BigNumber(totals.receivedAmount)
        : undefined;
      const nativePrice = new BigNumber(
        current.snapshot.nativeToken.price ?? '',
      );
      defaultLogger.dex.dustSweep.dustSweepResult({
        network: current.snapshot.networkId,
        totalCount: current.items.length,
        successCount: totals.successCount,
        skippedCount: totals.skippedCount,
        failedCount: totals.failedCount,
        receiptAvailable,
        receivedAmount: receivedAmount?.toNumber() ?? null,
        receivedUsd:
          receivedAmount && nativePrice.isFinite() && nativePrice.gt(0)
            ? receivedAmount.times(nativePrice).toNumber()
            : null,
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
    // Before the last token settles, hold until the sweep has run minRunMs.
    const holdBeforeLastResult = async () => {
      if (stateRef.current.items.some((entry) => entry.status === 'waiting'))
        return;
      const wait = started.current + minRunMs - Date.now();
      if (wait <= 0) return;
      // Stop releases the hold and Leave aborts the signal; don't keep either
      // waiting on it. The listener goes away with this session's signal.
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => releaseHold.current?.(), wait);
        releaseHold.current = () => {
          clearTimeout(timer);
          releaseHold.current = undefined;
          resolve();
        };
        signal.addEventListener('abort', () => releaseHold.current?.(), {
          once: true,
        });
      });
    };
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
            onSubmissionError: (message) =>
              send({ ...identity, type: 'submissionError', message }),
            generateSwapHistoryItem: (params) =>
              generateSwapHistoryItemForContext(params, {
                swapNetworks: networks.map((entry) => entry.network),
                currencyInfo: { id: 'usd', symbol: '$' },
              }),
          });
          if (signal.aborted) break;
          // Already settled, so record it even if Stop / Leave cut the hold.
          await holdBeforeLastResult();
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
            providerErrorMessage:
              result.status === 'failed' ? result.message : undefined,
          });
          defaultLogger.dex.dustSweep.dustSweepItemResult({
            network: snapshot.networkId,
            tokenSymbol: item.token.symbol,
            tokenValueUsd: new BigNumber(item.token.valueUsd).toNumber(),
            status: result.status,
            reason: result.status === 'failed' ? 'txFailed' : '',
          });
        } catch (error) {
          if (error instanceof DustSweepUnknownSubmission) {
            send({
              ...identity,
              status: 'unknown',
              reason: 'unknown',
              submissionErrorMessage: error.submissionErrorMessage,
            });
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
            send({ type: 'pause' });
            break;
          }
          const reason =
            error instanceof DustSweepSkip ? error.reason : 'unknown';
          // Already settled, so record it even if Stop / Leave cut the hold.
          await holdBeforeLastResult();
          send({
            ...identity,
            status: 'skipped',
            reason,
            message: error instanceof Error ? error.message : undefined,
            providerErrorMessage:
              error instanceof DustSweepSkip
                ? error.providerErrorMessage
                : undefined,
          });
          defaultLogger.dex.dustSweep.dustSweepItemResult({
            network: snapshot.networkId,
            tokenSymbol: item.token.symbol,
            tokenValueUsd: new BigNumber(item.token.valueUsd).toNumber(),
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
  }, [networks, reportResult, send, minRunMs]);

  const start = useCallback(
    (
      input: IDustSweepSnapshot,
      { hiddenTokenCount = 0 }: { hiddenTokenCount?: number } = {},
    ) => {
      if (
        !mounted.current ||
        stateRef.current.phase !== 'selecting' ||
        running.current ||
        !input.tokens.length
      )
        return;
      sessionSequence += 1;
      const snapshot = { ...input, id: `${input.id}:${sessionSequence}` };
      controller.current = new AbortController();
      started.current = Date.now();
      reported.current = false;
      send({ type: 'start', snapshot });
      defaultLogger.dex.dustSweep.dustSweepStart({
        network: snapshot.networkId,
        tokenCount: snapshot.tokens.length,
        totalUsd: snapshot.tokens
          .reduce((sum, token) => sum.plus(token.valueUsd), new BigNumber(0))
          .toNumber(),
        slippage: snapshot.slippage,
      });
      defaultLogger.dex.dustSweep.dustSweepPageVisited({
        page: 'progress',
        tokenCount: snapshot.tokens.length,
        hiddenTokenCount,
      });
      run();
      return snapshot.id;
    },
    [run, send],
  );

  const resume = useCallback(() => {
    if (stoppingRef.current) return;
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
  const stop = useCallback(
    async (onStopped?: (batch: IDustSweepState) => void) => {
      if (stateRef.current.phase !== 'paused' || stoppingRef.current)
        return false;
      stoppingRef.current = true;
      setStopping(true);
      try {
        // Don't abort: a broadcast swap or approval must settle before the
        // balances reload, or the same token could be submitted again. Paused,
        // the worker signs nothing new and exits once its current item settles.
        releaseHold.current?.();
        await running.current;
        controller.current?.abort();
      } finally {
        stoppingRef.current = false;
        if (mounted.current) setStopping(false);
      }
      // An unconfirmed submission moves the session to blocked; keep it there.
      if (!mounted.current || stateRef.current.phase !== 'paused') return false;
      reportResult('stopped');
      // Expose settled items before reset so their owner can refresh balances.
      onStopped?.(stateRef.current);
      send({ type: 'stop' });
      return true;
    },
    [reportResult, send],
  );
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
    stop,
    stopping,
    reset,
    leave,
    leaving: state.phase === 'leaving',
  };
}
