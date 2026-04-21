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
      .map((p) => ({ protocol: p, netWorth: getNetWorth(p) }))
      .toSorted((a, b) => b.netWorth - a.netWorth);
  }, [protocols, getNetWorth]);
}
