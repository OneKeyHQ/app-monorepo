import BigNumber from 'bignumber.js';

import { EHyperLiquidAbstractionMode } from '../../types/hyperliquid';

export type IPerpsCrossMarginRatio = {
  // unavailable: the mode has a ratio we cannot compute, so callers hide it.
  status: 'loading' | 'ready' | 'unavailable';
  mmr: string | null;
  mmrPercent: string | null;
};

const LOADING: IPerpsCrossMarginRatio = {
  status: 'loading',
  mmr: null,
  mmrPercent: null,
};

function buildReadyRatio(mmr: BigNumber | null): IPerpsCrossMarginRatio {
  return {
    status: 'ready',
    mmr: mmr ? mmr.decimalPlaces(8).toFixed() : null,
    mmrPercent: mmr ? mmr.multipliedBy(100).toFixed(2) : null,
  };
}

export function computePerpsCrossMarginRatio(params: {
  mode: EHyperLiquidAbstractionMode | undefined;
  crossMaintenanceMarginUsed: string | undefined;
  crossAccountValue: string | undefined;
  isolatedMarginUsed: string | undefined;
  // Spot total of the collateral token shared by the supported DEXs.
  spotCollateralTotal: string | undefined;
}): IPerpsCrossMarginRatio {
  const { mode, crossMaintenanceMarginUsed, crossAccountValue } = params;

  if (!mode || !crossMaintenanceMarginUsed) {
    return LOADING;
  }

  // Hyperliquid's portfolio margin ratio needs borrow caps, LTVs and borrowed
  // sizes that no feed we read carries.
  if (mode === EHyperLiquidAbstractionMode.PORTFOLIO_MARGIN) {
    return { status: 'unavailable', mmr: null, mmrPercent: null };
  }

  const maintenanceMarginUsed = new BigNumber(crossMaintenanceMarginUsed);

  if (mode === EHyperLiquidAbstractionMode.UNIFIED_ACCOUNT) {
    if (params.spotCollateralTotal === undefined) {
      return LOADING;
    }
    // Unified collateral lives in the spot balance; the perp-side account value
    // is only the margin held for open positions.
    const available = new BigNumber(params.spotCollateralTotal).minus(
      params.isolatedMarginUsed || '0',
    );
    if (!available.isGreaterThan(0)) {
      return buildReadyRatio(new BigNumber(0));
    }
    return buildReadyRatio(
      BigNumber.min(maintenanceMarginUsed.dividedBy(available), 1),
    );
  }

  const accountValue = new BigNumber(crossAccountValue || '0');
  if (!accountValue.isGreaterThan(0)) {
    return buildReadyRatio(null);
  }
  return buildReadyRatio(maintenanceMarginUsed.dividedBy(accountValue));
}
