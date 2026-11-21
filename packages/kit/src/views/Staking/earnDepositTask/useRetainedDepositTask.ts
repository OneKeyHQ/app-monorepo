import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { isTaskAccountCurrent } from '@onekeyhq/kit/src/views/Earn/tasks/taskAccount';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';

import { useCommittedEarnScopeGuard } from '../hooks/useCommittedEarnScopeGuard';

import {
  canDiscardDetachedSetup,
  discardDetachedSetup,
} from './finishRetainedRecording';
import { depositTaskRegistry } from './registry';

import type { IDepositTask, IDepositTaskState } from './state';

export { getDepositTaskOwnerKey } from './registry';

export type IRetainedDepositTask = {
  task: IDepositTask;
  state: IDepositTaskState;
  token: symbol;
};

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
    const isOwnerCurrent = ownerGuard.capture();
    const publish = () => {
      if (!active || !isOwnerCurrent()) return;
      if (depositTaskRegistry.find(seed.ownerKey) !== entry) {
        setResult({ seed, status: 'none' });
      } else if (validated) {
        const task = entry.state.getTask();
        const deposit = task.steps.at(-1);
        if (
          entry.detached &&
          earnUtils.isEtherFiProvider({
            providerName: task.identity.provider,
          }) &&
          canDiscardDetachedSetup(task)
        ) {
          if (finishing === task) return;
          finishing = task;
          setResult({ seed, status: 'checking' });
          void discardDetachedSetup({
            ownerKey: seed.ownerKey,
            task,
            canDiscard: () => active && isOwnerCurrent() && finishing === task,
          }).then((discarded) => {
            if (!active || !isOwnerCurrent() || finishing !== task) return;
            finishing = undefined;
            if (discarded) {
              try {
                onFinishedRef.current?.();
              } catch (error) {
                errorToastUtils.showToastOfError(error);
              }
            } else if (depositTaskRegistry.find(seed.ownerKey) === entry) {
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
        if (
          entry.detached &&
          earnUtils.isEtherFiProvider({
            providerName: task.identity.provider,
          }) &&
          deposit?.kind === 'deposit' &&
          (deposit.status.type === 'handedOff' ||
            (deposit.status.type === 'unknown' &&
              !deposit.status.txidConflict)) &&
          deposit.attemptId &&
          task.recording?.status === 'succeeded' &&
          task.recording.txid === deposit.status.txid
        ) {
          if (finishing === task) return;
          finishing = task;
          setResult({ seed, status: 'checking' });
          void isTaskAccountCurrent(task.identity)
            .catch(() => false)
            .then((matches) => {
              if (!active || !isOwnerCurrent() || finishing !== task) return;
              finishing = undefined;
              if (
                matches &&
                depositTaskRegistry.find(seed.ownerKey) === entry &&
                entry.detached &&
                entry.state.getTask() === task &&
                depositTaskRegistry.release(seed.ownerKey, entry.token)
              ) {
                try {
                  onFinishedRef.current?.();
                } catch (error) {
                  errorToastUtils.showToastOfError(error);
                }
              } else if (depositTaskRegistry.find(seed.ownerKey) === entry) {
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
        if (!active || !isOwnerCurrent()) return;
        if (!matches) {
          setResult({ seed, status: 'unavailable' });
          return;
        }
        validated = true;
        publish();
      })
      .catch(() => {
        if (active && isOwnerCurrent())
          setResult({ seed, status: 'unavailable' });
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
