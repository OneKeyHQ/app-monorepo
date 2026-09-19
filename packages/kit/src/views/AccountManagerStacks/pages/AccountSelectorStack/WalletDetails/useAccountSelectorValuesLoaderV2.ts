import { useEffect, useRef, useState } from 'react';

import { isEqual } from 'lodash';

import type backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { accountSelectorValuesMapAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  IAccountSelectorValueItem,
  IAccountSelectorValuesMap,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { buildAccountSelectorAccountsValuesDataOnce } from './accountSelectorValuesRequest';

const BATCH_SIZE = 50;
const WORK_BUDGET_MS = 8;
const loadedNetworkByNum = new Map<number, string | undefined>();
type IBuildValues =
  typeof backgroundApiProxy.serviceAccountSelector.buildAccountSelectorAccountsValuesData;
type ILoadParams = {
  num: number;
  accountsForValuesQuery: Parameters<IBuildValues>[0]['accounts'] | undefined;
  linkedNetworkId?: string;
};
type IAtomWriter<T> = { set: (update: (previous: T) => T) => Promise<unknown> };

// A resolved service Promise alone never gives the browser a paint opportunity.
export function yieldAccountSelectorValuesV2(): Promise<void> {
  return new Promise((resolve) => {
    const scheduled: {
      frame?: number;
      afterFrame?: ReturnType<typeof setTimeout>;
      fallback?: ReturnType<typeof setTimeout>;
    } = {};
    const finish = () => {
      if (scheduled.frame !== undefined) cancelAnimationFrame(scheduled.frame);
      clearTimeout(scheduled.fallback);
      clearTimeout(scheduled.afterFrame);
      resolve();
    };
    // Hidden windows may suspend rAF; do not retain a cancelled loader indefinitely.
    scheduled.fallback = setTimeout(finish, 100);
    scheduled.frame = requestAnimationFrame(() => {
      scheduled.afterFrame = setTimeout(finish, 0);
    });
  });
}

function pruneValues<T>(
  previous: Partial<Record<number, Record<string, T>>>,
  num: number,
  desiredIds: Set<string>,
  clear = false,
) {
  const current = previous[num];
  if (!current) return previous;
  if (!desiredIds.size) {
    const next = { ...previous };
    delete next[num];
    return next;
  }
  const keys = Object.keys(current);
  if (!clear && keys.every((key) => desiredIds.has(key))) return previous;
  const next: Record<string, T> = {};
  if (!clear) {
    for (const key of keys) if (desiredIds.has(key)) next[key] = current[key];
  }
  return { ...previous, [num]: next };
}

function mergeValues<T>(
  previous: Partial<Record<number, Record<string, T>>>,
  num: number,
  pending: Record<string, T>,
) {
  const current = previous[num];
  let next = current;
  for (const [key, value] of Object.entries(pending)) {
    if (!isEqual(current?.[key], value)) {
      if (!next || next === current) next = { ...current };
      next[key] = value;
    }
  }
  return next === current ? previous : { ...previous, [num]: next };
}

export async function loadAccountSelectorValuesV2(
  { num, accountsForValuesQuery, linkedNetworkId }: ILoadParams,
  {
    isCancelled,
    valuesAtom = accountSelectorValuesMapAtom,
    buildValues = buildAccountSelectorAccountsValuesDataOnce,
    yieldToUI = yieldAccountSelectorValuesV2,
    now = () => performance.now(),
    networkByNum = loadedNetworkByNum,
  }: {
    isCancelled: () => boolean;
    valuesAtom?: IAtomWriter<IAccountSelectorValuesMap>;
    buildValues?: IBuildValues;
    yieldToUI?: () => Promise<void>;
    now?: () => number;
    networkByNum?: Map<number, string | undefined>;
  },
) {
  const accounts = accountsForValuesQuery ?? [];
  const desiredIds = new Set(accounts.map((account) => account.accountId));
  // Perps worth carries no network scope, so values loaded under another
  // network must not stay combined with this network's rows.
  const networkChanged =
    networkByNum.has(num) && networkByNum.get(num) !== linkedNetworkId;
  await valuesAtom.set((previous) =>
    isCancelled()
      ? previous
      : pruneValues(previous, num, desiredIds, networkChanged),
  );
  if (isCancelled()) return false;
  if (!accounts.length) {
    networkByNum.delete(num);
    return true;
  }
  networkByNum.set(num, linkedNetworkId);

  // Pending results are bounded by this account set and dropped on cancellation.
  let pendingValues: Record<string, IAccountSelectorValueItem> = {};
  let hasPending = false;
  let firstResult = true;
  let sliceStarted = now();
  const publish = async () => {
    await valuesAtom.set((previous) =>
      isCancelled() ? previous : mergeValues(previous, num, pendingValues),
    );
    pendingValues = {};
    hasPending = false;
  };

  for (let start = 0; start < accounts.length; start += BATCH_SIZE) {
    if (isCancelled()) return false;
    const batch = accounts.slice(start, start + BATCH_SIZE);
    try {
      const { accountsValue, accountsDeFiOverview } = await buildValues({
        accounts: batch,
        linkedNetworkId,
      });
      if (isCancelled()) return false;
      const deFiByAccountId = new Map(
        batch.map((account, index) => [
          account.accountId,
          accountsDeFiOverview?.[index],
        ]),
      );
      for (const value of accountsValue ?? []) {
        if (value && desiredIds.has(value.accountId)) {
          // One publication carries both, so a row never mixes two loads.
          pendingValues[value.accountId] = {
            ...value,
            deFi: deFiByAccountId.get(value.accountId),
          };
        }
      }
      hasPending = true;
    } catch (_error) {
      // A failed service batch must not prevent later accounts from loading.
    }
    const budgetUsed = now() - sliceStarted >= WORK_BUDGET_MS;
    const lastBatch = start + BATCH_SIZE >= accounts.length;
    if (hasPending && (firstResult || budgetUsed || lastBatch)) {
      try {
        await publish();
      } catch (_error) {
        // Keep pending results for the next publication if the bridge failed.
      }
      firstResult = false;
      if (isCancelled()) return false;
      if (!lastBatch) {
        await yieldToUI();
        sliceStarted = now();
      }
    } else if (budgetUsed && !lastBatch) {
      await yieldToUI();
      sliceStarted = now();
    }
  }
  return !isCancelled();
}

export function useAccountSelectorValuesLoaderV2({
  num,
  accountsForValuesQuery,
  linkedNetworkId,
}: ILoadParams) {
  const loadingIdRef = useRef(0);
  const [loaded, setLoaded] = useState<
    Pick<ILoadParams, 'accountsForValuesQuery' | 'linkedNetworkId'> | undefined
  >();
  useEffect(() => {
    loadingIdRef.current += 1;
    const loadId = loadingIdRef.current;
    const isCancelled = () => loadId !== loadingIdRef.current;
    void loadAccountSelectorValuesV2(
      { num, accountsForValuesQuery, linkedNetworkId },
      { isCancelled },
    ).then((completed) => {
      if (completed && !isCancelled()) {
        setLoaded({ accountsForValuesQuery, linkedNetworkId });
      }
    });
    // The shared atoms outlive this view; only cancel this view's pending work.
    return () => {
      loadingIdRef.current += 1;
    };
  }, [num, accountsForValuesQuery, linkedNetworkId]);
  // Every batch of the current account set has been published.
  return {
    valuesLoaded:
      !!accountsForValuesQuery &&
      loaded?.accountsForValuesQuery === accountsForValuesQuery &&
      loaded?.linkedNetworkId === linkedNetworkId,
  };
}
