import { useCallback, useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IAddressRiskCheckRecentItem } from '@onekeyhq/shared/types/addressRiskCheck';

// Loads local-only recent checks plus a networkId -> name map for display, and
// re-reads whenever the page regains focus (e.g. after running a new check).
export function useRecentChecks({ limit }: { limit?: number } = {}) {
  const { result, run } = usePromiseResult(
    async () => {
      const items =
        await backgroundApiProxy.simpleDb.addressRiskCheck.getRecentChecks({
          limit,
        });
      const networkIds = Array.from(new Set(items.map((i) => i.networkId)));
      const { networks } = networkIds.length
        ? await backgroundApiProxy.serviceNetwork.getNetworksByIds({
            networkIds,
          })
        : { networks: [] };
      const networkNameMap: Record<string, string> = {};
      networks.forEach((n) => {
        networkNameMap[n.id] = n.name;
      });
      return { items, networkNameMap };
    },
    [limit],
    {
      initResult: { items: [], networkNameMap: {} },
      revalidateOnFocus: true,
    },
  );

  const deleteOne = useCallback(
    async (item: IAddressRiskCheckRecentItem) => {
      await backgroundApiProxy.simpleDb.addressRiskCheck.deleteCheck({
        networkId: item.networkId,
        address: item.address,
      });
      await run();
    },
    [run],
  );

  const clearAll = useCallback(async () => {
    await backgroundApiProxy.simpleDb.addressRiskCheck.clearChecks();
    await run();
  }, [run]);

  return useMemo(
    () => ({
      items: result.items,
      networkNameMap: result.networkNameMap,
      reload: run,
      deleteOne,
      clearAll,
    }),
    [result.items, result.networkNameMap, run, deleteOne, clearAll],
  );
}
