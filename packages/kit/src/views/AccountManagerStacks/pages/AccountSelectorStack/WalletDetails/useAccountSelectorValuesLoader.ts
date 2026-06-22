import { useEffect, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  accountSelectorDeFiMapAtom,
  accountSelectorValuesMapAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  IAccountSelectorDeFiItem,
  IAccountSelectorValueItem,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';

const BATCH_SIZE = 50;

function isCancelled(currentLoadId: number, loadingIdRef: { current: number }) {
  return currentLoadId !== loadingIdRef.current;
}

export function useAccountSelectorValuesLoader({
  num,
  accountsForValuesQuery,
}: {
  num: number;
  accountsForValuesQuery:
    | {
        accountId: string;
        networkId: string;
        indexedAccountId?: string;
        accountAddress?: string;
        xpub?: string;
      }[]
    | undefined;
}) {
  const loadingIdRef = useRef(0);

  useEffect(() => {
    if (!accountsForValuesQuery || accountsForValuesQuery.length === 0) {
      void (async () => {
        const prev = await accountSelectorValuesMapAtom.get();
        const next = { ...prev };
        delete next[num];
        await accountSelectorValuesMapAtom.set(next);

        const prevD = await accountSelectorDeFiMapAtom.get();
        const nextD = { ...prevD };
        delete nextD[num];
        await accountSelectorDeFiMapAtom.set(nextD);
      })();
      return;
    }

    loadingIdRef.current += 1;
    const currentLoadId = loadingIdRef.current;

    const loadBatches = async () => {
      // Prune this selector's sub-map: drop entries whose accountId is no
      // longer in the new query, but PRESERVE entries that are still
      // relevant. The previous behavior set `next[num] = {}` which wiped
      // already-loaded balances every time `accountsForValuesQuery`
      // changed reference, causing a visible "loaded -> '--' -> loaded"
      // flicker when the effect re-ran for the same wallet (e.g. when
      // listDataResult re-mounted but the account set was unchanged).
      // New accountIds simply have no entry yet and render the "--"
      // placeholder naturally until the batch below fills them in.
      const desiredIds = new Set(
        accountsForValuesQuery.map((a) => a.accountId),
      );
      {
        const prev = await accountSelectorValuesMapAtom.get();
        if (isCancelled(currentLoadId, loadingIdRef)) return;
        const prevSub = prev[num] || {};
        const prunedSub: Record<string, IAccountSelectorValueItem> = {};
        for (const id of Object.keys(prevSub)) {
          if (desiredIds.has(id)) prunedSub[id] = prevSub[id];
        }
        const next = {
          ...prev,
          [num]: prunedSub,
        };
        await accountSelectorValuesMapAtom.set(next);
      }
      {
        const prev = await accountSelectorDeFiMapAtom.get();
        if (isCancelled(currentLoadId, loadingIdRef)) return;
        const prevSub = prev[num] || {};
        const prunedSub: Record<string, IAccountSelectorDeFiItem> = {};
        for (const id of Object.keys(prevSub)) {
          if (desiredIds.has(id)) prunedSub[id] = prevSub[id];
        }
        const next = {
          ...prev,
          [num]: prunedSub,
        };
        await accountSelectorDeFiMapAtom.set(next);
      }

      for (
        let start = 0;
        start < accountsForValuesQuery.length;
        start += BATCH_SIZE
      ) {
        if (isCancelled(currentLoadId, loadingIdRef)) return;

        const batch = accountsForValuesQuery.slice(start, start + BATCH_SIZE);

        try {
          const { accountsValue, accountsDeFiOverview } =
            await backgroundApiProxy.serviceAccountSelector.buildAccountSelectorAccountsValuesData(
              { accounts: batch },
            );

          if (isCancelled(currentLoadId, loadingIdRef)) return;

          // Merge values into this selector's sub-map
          const prevAll = await accountSelectorValuesMapAtom.get();
          if (isCancelled(currentLoadId, loadingIdRef)) return;
          const subMap: Record<string, IAccountSelectorValueItem> = {
            ...prevAll[num],
          };
          accountsValue?.forEach((v) => {
            if (v) {
              subMap[v.accountId] = v;
            }
          });
          const newAll = {
            ...prevAll,
            [num]: subMap,
          };
          await accountSelectorValuesMapAtom.set(newAll);

          if (isCancelled(currentLoadId, loadingIdRef)) return;

          // Merge DeFi into this selector's sub-map
          const prevAllD = await accountSelectorDeFiMapAtom.get();
          if (isCancelled(currentLoadId, loadingIdRef)) return;
          const subMapD: Record<string, IAccountSelectorDeFiItem> = {
            ...prevAllD[num],
          };
          batch.forEach((account, batchIdx) => {
            const overview = accountsDeFiOverview?.[batchIdx];
            subMapD[account.accountId] = overview;
          });
          const newAllD = {
            ...prevAllD,
            [num]: subMapD,
          };
          await accountSelectorDeFiMapAtom.set(newAllD);
        } catch (_error) {
          // Batch failed, continue with next batch
        }
      }
    };

    void loadBatches();

    return () => {
      // Increment loadingId to cancel ongoing batches
      loadingIdRef.current += 1;
    };
  }, [num, accountsForValuesQuery]);
}
