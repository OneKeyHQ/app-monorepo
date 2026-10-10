import { useMemo } from 'react';

import {
  usePerpsAbstractionModeAtom,
  usePerpsActiveAccountAtom,
  usePerpsLiquidationRiskInputsAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  parseDexCoin,
  resolveCrossAvailableAfterMaintenance,
} from '@onekeyhq/shared/src/utils/perpsUtils';

import type { BigNumber } from 'bignumber.js';

// Free cross collateral for the coin's dex, net of all cross maintenance
// margin; undefined until live data for the active account has arrived.
export function usePerpsCrossAvailableAfterMaintenance(
  coin: string | undefined,
): BigNumber | undefined {
  const [activeAccount] = usePerpsActiveAccountAtom();
  const [abstractionMode] = usePerpsAbstractionModeAtom();
  const [riskInputs] = usePerpsLiquidationRiskInputsAtom();

  return useMemo(() => {
    const accountAddress = activeAccount?.accountAddress?.toLowerCase();
    if (
      !coin ||
      !accountAddress ||
      abstractionMode?.source !== 'live' ||
      abstractionMode?.accountAddress?.toLowerCase() !== accountAddress ||
      riskInputs?.accountAddress?.toLowerCase() !== accountAddress ||
      riskInputs.abstractionMode !== abstractionMode.mode
    ) {
      return undefined;
    }
    return resolveCrossAvailableAfterMaintenance({
      mode: abstractionMode.mode,
      dex: parseDexCoin(coin).dexLabel ?? '',
      tokenToAvailableAfterMaintenance:
        riskInputs.tokenToAvailableAfterMaintenance,
      crossMarginByDex: riskInputs.crossMarginByDex,
    });
  }, [
    abstractionMode?.accountAddress,
    abstractionMode?.mode,
    abstractionMode?.source,
    activeAccount?.accountAddress,
    coin,
    riskInputs,
  ]);
}
