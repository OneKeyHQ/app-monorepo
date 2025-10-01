import { useMemo } from 'react';

import { BigNumber } from 'bignumber.js';

import {
  usePerpsActivePositionAtom,
  useTradingFormAtom,
  useTradingFormComputedAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsActiveAccountSummaryAtom,
  usePerpsActiveAssetAtom,
  usePerpsActiveAssetCtxAtom,
  usePerpsActiveAssetDataAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { calculateLiquidationPrice } from '@onekeyhq/shared/src/utils/perpsUtils';

export function useLiquidationPrice(
  overrideSide?: 'long' | 'short',
): BigNumber | null {
  const [formData] = useTradingFormAtom();
  const [tradingComputed] = useTradingFormComputedAtom();
  const [activeAsset] = usePerpsActiveAssetAtom();
  const [activeAssetCtx] = usePerpsActiveAssetCtxAtom();
  const [activeAssetData] = usePerpsActiveAssetDataAtom();
  const [accountSummary] = usePerpsActiveAccountSummaryAtom();
  const [{ activePositions: perpsPositions }] = usePerpsActivePositionAtom();
  const { coin, margin } = activeAsset;

  const stableAccountValues = useMemo(
    () => ({
      crossAccountValue: accountSummary?.crossAccountValue || '0',
      crossMaintenanceMarginUsed:
        accountSummary?.crossMaintenanceMarginUsed || '0',
    }),
    [
      accountSummary?.crossAccountValue,
      accountSummary?.crossMaintenanceMarginUsed,
    ],
  );

  const referencePrice = useMemo(() => {
    if (formData.type === 'limit' && formData.price) {
      return new BigNumber(formData.price);
    }
    if (formData.type === 'market' && activeAssetCtx?.ctx?.markPrice) {
      return new BigNumber(activeAssetCtx.ctx.markPrice);
    }
    return new BigNumber(0);
  }, [formData.type, formData.price, activeAssetCtx?.ctx?.markPrice]);

  const totalValue = useMemo(() => {
    return tradingComputed.computedSizeBN.multipliedBy(referencePrice);
  }, [tradingComputed.computedSizeBN, referencePrice]);

  const leverage = useMemo(() => {
    return (
      activeAssetData?.leverage?.value || activeAsset?.universe?.maxLeverage
    );
  }, [activeAssetData?.leverage?.value, activeAsset?.universe?.maxLeverage]);

  const currentCoinPosition = useMemo(() => {
    return perpsPositions.filter((pos) => pos.position.coin === coin)?.[0]
      ?.position;
  }, [perpsPositions, coin]);

  const effectiveSide = overrideSide || formData.side;

  const liquidationPrice: BigNumber | null = useMemo(() => {
    if (!leverage || !activeAssetData?.leverage.type) return null;

    const positionSize = tradingComputed.computedSizeBN;
    if (positionSize.isZero()) return null;

    // Use unified function - it will automatically choose the optimal calculation path
    const _liquidationPrice = calculateLiquidationPrice({
      totalValue,
      referencePrice,
      markPrice: activeAssetCtx?.ctx?.markPrice
        ? new BigNumber(activeAssetCtx.ctx.markPrice)
        : undefined,
      positionSize,
      side: effectiveSide,
      leverage,
      mode: activeAssetData?.leverage.type,
      marginTiers: margin?.marginTiers,
      maxLeverage: activeAsset?.universe?.maxLeverage || 1,
      crossMarginUsed: new BigNumber(stableAccountValues.crossAccountValue),
      crossMaintenanceMarginUsed: new BigNumber(
        stableAccountValues.crossMaintenanceMarginUsed,
      ),
      // Optional existing position parameters - function will check if they're meaningful
      existingPositionSize: currentCoinPosition
        ? new BigNumber(currentCoinPosition.szi)
        : undefined,
      existingEntryPrice: currentCoinPosition
        ? new BigNumber(currentCoinPosition.entryPx)
        : undefined,
      newOrderSide: effectiveSide,
    });
    return _liquidationPrice?.gt(0) ? _liquidationPrice : null;
  }, [
    activeAsset?.universe?.maxLeverage,
    activeAssetCtx?.ctx?.markPrice,
    activeAssetData?.leverage.type,
    currentCoinPosition,
    effectiveSide,
    tradingComputed.computedSizeBN,
    leverage,
    margin?.marginTiers,
    referencePrice,
    stableAccountValues.crossAccountValue,
    stableAccountValues.crossMaintenanceMarginUsed,
    totalValue,
  ]);

  return liquidationPrice;
}
