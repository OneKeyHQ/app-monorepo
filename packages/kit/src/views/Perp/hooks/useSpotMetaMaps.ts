import { useEffect, useMemo, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { getSpotTokenDisplayName } from '@onekeyhq/shared/src/utils/perpsUtils';
import type { ISpotUniverse } from '@onekeyhq/shared/types/hyperliquid';

export function useSpotMetaMaps() {
  const [spotUniverses, setSpotUniverses] = useState<ISpotUniverse[]>([]);
  const [tokenContractMap, setTokenContractMap] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    let isCancelled = false;

    void backgroundApiProxy.serviceHyperliquid.getSpotMeta().then((meta) => {
      if (isCancelled) {
        return;
      }

      setSpotUniverses(meta.universes ?? []);

      const contractMap: Record<string, string> = {};
      for (const token of meta.tokens ?? []) {
        if (token.evmContract?.address) {
          contractMap[token.name] = token.evmContract.address;
          contractMap[getSpotTokenDisplayName(token.name)] =
            token.evmContract.address;
        }
      }
      setTokenContractMap(contractMap);
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  const universeByBaseName = useMemo(
    () =>
      Object.fromEntries(
        spotUniverses.map((universe) => [universe.baseName, universe]),
      ) as Record<string, ISpotUniverse>,
    [spotUniverses],
  );

  return {
    spotUniverses,
    universeByBaseName,
    tokenContractMap,
  };
}
