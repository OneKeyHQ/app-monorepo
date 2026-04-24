import { useMemo } from 'react';

import type { IDeFiProtocol } from '@onekeyhq/shared/types/defi';

export type IDeFiOverviewCell = {
  protocol: IDeFiProtocol;
  netWorth: number;
};

export function useDeFiOverviewTopN(
  protocols: IDeFiProtocol[] | undefined,
  getNetWorth: (p: IDeFiProtocol) => number,
): IDeFiOverviewCell[] {
  return useMemo<IDeFiOverviewCell[]>(() => {
    if (!protocols || protocols.length === 0) {
      return [];
    }
    return protocols
      .map((protocol, originalIndex) => ({
        protocol,
        originalIndex,
        netWorth: getNetWorth(protocol),
      }))
      .toSorted((a, b) => {
        const aExposure = Math.abs(a.netWorth);
        const bExposure = Math.abs(b.netWorth);
        if (aExposure !== bExposure) return bExposure - aExposure;
        return a.originalIndex - b.originalIndex;
      })
      .map(({ protocol, netWorth }) => ({ protocol, netWorth }));
  }, [protocols, getNetWorth]);
}
