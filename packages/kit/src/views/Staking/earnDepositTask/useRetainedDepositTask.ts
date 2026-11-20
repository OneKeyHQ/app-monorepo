import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';

import { useCommittedEarnScopeGuard } from '../hooks/useCommittedEarnScopeGuard';

import {
  canDiscardDetachedSetup,
  discardDetachedSetup,
  finishRetainedRecording,
  hasRecording,
} from './finishRetainedRecording';
import { depositTaskRegistry } from './registry';
import { isTaskAccountCurrent } from './taskAccount';
import { normalizeTaskAccountAddress } from './taskAddress';

import type { IDepositTask, IDepositTaskState } from './state';

export type IRetainedDepositTask = {
  task: IDepositTask;
  state: IDepositTaskState;
  token: symbol;
};

export function getDepositTaskOwnerKey({
  accountId,
  accountAddress,
  networkId,
  provider,
  vault,
}: {
  accountId: string;
  accountAddress?: string;
  networkId: string;
  provider?: string;
  vault?: string;
}) {
  return JSON.stringify([
    accountId,
    normalizeTaskAccountAddress(networkId, accountAddress),
    networkId,
    provider?.toLowerCase(),
    normalizeTaskAccountAddress(networkId, vault),
  ]);
}

export function useRetainedDepositTask(
  ownerKey: string,
  onFinished?: () => void,
) {
  const ownerGuard = useCommittedEarnScopeGuard(ownerKey);
  const onFinishedRef = useRef(onFinished);
  useLayoutEffect(() => {
    onFinishedRef.current = onFinished;
  }, [onFinished]);
  // Capture only an entry already present when this owner is mounted. A task
  // created by the active form must not remount that form while it is running.
  const seed = useMemo(
    () => ({ ownerKey, entry: depositTaskRegistry.find(ownerKey) }),
    [ownerKey],
  );
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<
    | { seed: typeof seed; status: 'checking' | 'unavailable' | 'none' }
    | { seed: typeof seed; status: 'ready'; value: IRetainedDepositTask }
    | undefined
  >();

  useEffect(() => {
    const entry = seed.entry;
    if (!entry) return undefined;
    let active = true;
    let validated = false;
    let finishing: IDepositTask | undefined;
    const isCurrentOwner = ownerGuard.capture();
    const publish = () => {
      if (!active) return;
      if (depositTaskRegistry.find(seed.ownerKey) !== entry) {
        finishing = undefined;
        setResult({ seed, status: 'none' });
      } else if (validated) {
        const task = entry.state.getTask();
        const deposit = task.steps.at(-1);
        const recording = task.recording;
        if (entry.detached && canDiscardDetachedSetup(task)) {
          if (finishing === task) return;
          finishing = task;
          setResult({ seed, status: 'checking' });
          void discardDetachedSetup({
            ownerKey: seed.ownerKey,
            task,
            canDiscard: () =>
              active &&
              isCurrentOwner() &&
              validated &&
              finishing === task &&
              entry.state.getTask() === task,
          })
            .catch(() => false)
            .then((discarded) => {
              if (!active || finishing !== task) return;
              finishing = undefined;
              if (
                !discarded &&
                depositTaskRegistry.find(seed.ownerKey) === entry
              ) {
                setResult({
                  seed,
                  status: 'ready',
                  value: {
                    state: entry.state,
                    task: entry.state.getTask(),
                    token: entry.token,
                  },
                });
              }
            });
          return;
        }
        // A recorded deposit no longer needs to occupy the recovery form, even
        // while the transaction is still pending on chain.
        if (
          hasRecording(task) &&
          deposit?.attemptId &&
          recording?.txid &&
          recording.status === 'succeeded'
        ) {
          if (finishing === task) return;
          finishing = task;
          setResult({ seed, status: 'checking' });
          void finishRetainedRecording({
            ownerKey: seed.ownerKey,
            taskId: task.taskId,
            txid: recording.txid,
            canFinish: () =>
              active &&
              isCurrentOwner() &&
              validated &&
              finishing === task &&
              entry.state.getTask() === task,
          })
            .catch(() => false)
            .then((finished) => {
              if (finished) {
                if (active && isCurrentOwner()) {
                  try {
                    onFinishedRef.current?.();
                  } catch (error) {
                    errorToastUtils.showToastOfError(error);
                  }
                }
                return;
              }
              if (!active || finishing !== task) return;
              finishing = undefined;
              if (depositTaskRegistry.find(seed.ownerKey) === entry) {
                setResult({
                  seed,
                  status: 'ready',
                  value: {
                    state: entry.state,
                    task: entry.state.getTask(),
                    token: entry.token,
                  },
                });
              }
            });
          return;
        }
        finishing = undefined;
        setResult({
          seed,
          status: 'ready',
          value: {
            state: entry.state,
            task,
            token: entry.token,
          },
        });
      }
    };
    setResult({ seed, status: 'checking' });
    const unsubscribe = depositTaskRegistry.subscribe(publish);
    void isTaskAccountCurrent(entry.state.getTask().identity)
      .then((matches) => {
        if (!active) return;
        if (!matches) {
          setResult({ seed, status: 'unavailable' });
          return;
        }
        validated = true;
        publish();
      })
      .catch(() => {
        if (active) setResult({ seed, status: 'unavailable' });
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [seed, revision, ownerGuard]);

  const retry = () => setRevision((value) => value + 1);
  if (!seed.entry) return { status: 'none' as const, retry };
  if (!result || result.seed !== seed)
    return { status: 'checking' as const, retry };
  if (result.status === 'ready') return { ...result, retry };
  return { status: result.status, retry };
}
