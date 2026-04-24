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

  const universeByBaseName = useMemo(() => {
    const map: Record<string, ISpotUniverse> = {};
    // First pass: prefer USDC-quoted pair so default switch lands on USDC.
    for (const u of spotUniverses) {
      if (u.quoteName === 'USDC') {
        map[u.baseName] = u;
      }
    }
    // Second pass: fill remaining base coins with any quote.
    for (const u of spotUniverses) {
      if (!map[u.baseName]) {
        map[u.baseName] = u;
      }
    }
    return map;
  }, [spotUniverses]);

  return {
    spotUniverses,
    universeByBaseName,
    tokenContractMap,
  };
}
