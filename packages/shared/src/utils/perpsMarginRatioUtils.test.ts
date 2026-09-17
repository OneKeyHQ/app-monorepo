import { EHyperLiquidAbstractionMode } from '../../types/hyperliquid';

import { computePerpsCrossMarginRatio } from './perpsMarginRatioUtils';

describe('computePerpsCrossMarginRatio', () => {
  const perpSide = {
    crossMaintenanceMarginUsed: '5.230225',
    crossAccountValue: '10.768008',
    isolatedMarginUsed: '0',
  };

  it('measures a unified account against its spot collateral, not the perp-side hold', () => {
    expect(
      computePerpsCrossMarginRatio({
        ...perpSide,
        mode: EHyperLiquidAbstractionMode.UNIFIED_ACCOUNT,
        spotCollateralTotal: '513.85341389',
      }),
    ).toEqual({ status: 'ready', mmr: '0.01017844', mmrPercent: '1.02' });
  });

  it('takes isolated margin out of the unified collateral', () => {
    expect(
      computePerpsCrossMarginRatio({
        ...perpSide,
        crossMaintenanceMarginUsed: '10',
        isolatedMarginUsed: '100',
        mode: EHyperLiquidAbstractionMode.UNIFIED_ACCOUNT,
        spotCollateralTotal: '300',
      }),
    ).toMatchObject({ status: 'ready', mmrPercent: '5.00' });
  });

  it('caps the unified ratio at 100%', () => {
    expect(
      computePerpsCrossMarginRatio({
        ...perpSide,
        crossMaintenanceMarginUsed: '50',
        mode: EHyperLiquidAbstractionMode.UNIFIED_ACCOUNT,
        spotCollateralTotal: '20',
      }),
    ).toMatchObject({ status: 'ready', mmrPercent: '100.00' });
  });

  it('reads zero when a unified account has no free collateral to measure against', () => {
    expect(
      computePerpsCrossMarginRatio({
        ...perpSide,
        isolatedMarginUsed: '30',
        mode: EHyperLiquidAbstractionMode.UNIFIED_ACCOUNT,
        spotCollateralTotal: '30',
      }),
    ).toMatchObject({ status: 'ready', mmrPercent: '0.00' });
  });

  it('waits for the spot balance before rating a unified account', () => {
    expect(
      computePerpsCrossMarginRatio({
        ...perpSide,
        mode: EHyperLiquidAbstractionMode.UNIFIED_ACCOUNT,
        spotCollateralTotal: undefined,
      }),
    ).toEqual({ status: 'loading', mmr: null, mmrPercent: null });
  });

  it('keeps the perp-side ratio for a standard account', () => {
    expect(
      computePerpsCrossMarginRatio({
        ...perpSide,
        mode: EHyperLiquidAbstractionMode.DISABLED,
        spotCollateralTotal: '513.85341389',
      }),
    ).toMatchObject({ status: 'ready', mmrPercent: '48.57' });
  });

  it('has no trustworthy ratio for portfolio margin', () => {
    expect(
      computePerpsCrossMarginRatio({
        ...perpSide,
        mode: EHyperLiquidAbstractionMode.PORTFOLIO_MARGIN,
        spotCollateralTotal: '513.85341389',
      }),
    ).toEqual({ status: 'unavailable', mmr: null, mmrPercent: null });
  });

  it('stays loading until the account mode is known', () => {
    expect(
      computePerpsCrossMarginRatio({
        ...perpSide,
        mode: undefined,
        spotCollateralTotal: '513.85341389',
      }),
    ).toEqual({ status: 'loading', mmr: null, mmrPercent: null });
  });

  it('stays loading until the perp summary arrives', () => {
    expect(
      computePerpsCrossMarginRatio({
        crossMaintenanceMarginUsed: undefined,
        crossAccountValue: undefined,
        isolatedMarginUsed: undefined,
        mode: EHyperLiquidAbstractionMode.UNIFIED_ACCOUNT,
        spotCollateralTotal: '513.85341389',
      }),
    ).toEqual({ status: 'loading', mmr: null, mmrPercent: null });
  });
});
