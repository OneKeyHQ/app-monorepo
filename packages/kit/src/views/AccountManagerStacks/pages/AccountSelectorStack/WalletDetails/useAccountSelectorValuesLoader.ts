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
        const next = new Map(prev);
        next.delete(num);
        await accountSelectorValuesMapAtom.set(next);

        const prevD = await accountSelectorDeFiMapAtom.get();
        const nextD = new Map(prevD);
        nextD.delete(num);
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
        const next = new Map(prev);
        next.set(num, new Map());
        await accountSelectorValuesMapAtom.set(next);
      }
      {
        const prev = await accountSelectorDeFiMapAtom.get();
        if (isCancelled(currentLoadId, loadingIdRef)) return;
        const next = new Map(prev);
        next.set(num, new Map());
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
          const newAll = new Map(prevAll);
          const subMap = new Map<string, IAccountSelectorValueItem>(
            prevAll.get(num),
          );
          accountsValue?.forEach((v) => {
            if (v) {
              subMap.set(v.accountId, v);
            }
          });
          newAll.set(num, subMap);
          await accountSelectorValuesMapAtom.set(newAll);

          if (isCancelled(currentLoadId, loadingIdRef)) return;

          // Merge DeFi into this selector's sub-map
          const prevAllD = await accountSelectorDeFiMapAtom.get();
          if (isCancelled(currentLoadId, loadingIdRef)) return;
          const newAllD = new Map(prevAllD);
          const subMapD = new Map<string, IAccountSelectorDeFiItem>(
            prevAllD.get(num),
          );
          batch.forEach((account, batchIdx) => {
            const overview = accountsDeFiOverview?.[batchIdx];
            subMapD.set(account.accountId, overview);
          });
          newAllD.set(num, subMapD);
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
