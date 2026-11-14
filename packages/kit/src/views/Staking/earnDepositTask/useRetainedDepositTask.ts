import { useEffect, useMemo, useState } from 'react';

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

export function useRetainedDepositTask(ownerKey: string) {
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
    const publish = () => {
      if (!active) return;
      if (depositTaskRegistry.find(seed.ownerKey) !== entry) {
        setResult({ seed, status: 'none' });
      } else if (validated) {
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
  }, [seed, revision]);

  const retry = () => setRevision((value) => value + 1);
  if (!seed.entry) return { status: 'none' as const, retry };
  if (!result || result.seed !== seed)
    return { status: 'checking' as const, retry };
  if (result.status === 'ready') return { ...result, retry };
  return { status: result.status, retry };
}
