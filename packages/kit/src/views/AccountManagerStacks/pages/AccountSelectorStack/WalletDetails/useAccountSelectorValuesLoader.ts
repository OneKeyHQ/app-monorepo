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
      // Clear this selector's sub-map only
      {
        const prev = await accountSelectorValuesMapAtom.get();
        if (isCancelled(currentLoadId, loadingIdRef)) return;
        const next = {
          ...prev,
          [num]: {},
        };
        await accountSelectorValuesMapAtom.set(next);
      }
      {
        const prev = await accountSelectorDeFiMapAtom.get();
        if (isCancelled(currentLoadId, loadingIdRef)) return;
        const next = {
          ...prev,
          [num]: {},
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
