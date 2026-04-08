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
import {
  calculateLiquidationPrice,
  computeMaxTradeSize,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import { ETriggerOrderType } from '@onekeyhq/shared/types/hyperliquid/types';

import { useOrderPrice } from './useOrderPrice';

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

  const effectiveSide = overrideSide || formData.side;
  const { price: orderReferencePrice } = useOrderPrice(effectiveSide);

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

  const leverage = useMemo(() => {
    return (
      activeAssetData?.leverage?.value || activeAsset?.universe?.maxLeverage
    );
  }, [activeAssetData?.leverage?.value, activeAsset?.universe?.maxLeverage]);

  const currentCoinPosition = useMemo(() => {
    return perpsPositions.filter((pos) => pos.position.coin === coin)?.[0]
      ?.position;
  }, [perpsPositions, coin]);

  const liquidationPrice: BigNumber | null = useMemo(() => {
    if (!leverage || !activeAssetData?.leverage.type) return null;

    const isTriggerMode = formData.orderMode === 'trigger';
    if (isTriggerMode && formData.triggerReduceOnly) {
      return null;
    }

    let positionSize = tradingComputed.computedSizeBN;
    let referencePrice = orderReferencePrice;

    if (isTriggerMode) {
      const isLimitTrigger =
        formData.triggerOrderType === ETriggerOrderType.TRIGGER_LIMIT;
      const rawTriggerPrice = isLimitTrigger
        ? formData.executionPrice?.trim()
        : formData.triggerPrice?.trim();

      if (!rawTriggerPrice) {
        return null;
      }

      const triggerReferencePrice = new BigNumber(rawTriggerPrice);
      if (!triggerReferencePrice.isFinite() || triggerReferencePrice.lte(0)) {
        return null;
      }

      const previewMaxSize = computeMaxTradeSize({
        side: effectiveSide,
        price: triggerReferencePrice.toFixed(),
        markPrice: activeAssetCtx?.ctx?.markPrice,
        maxTradeSzs: activeAssetData?.maxTradeSzs,
        leverageValue: activeAssetData?.leverage?.value,
        fallbackLeverage: activeAsset?.universe?.maxLeverage,
        szDecimals: activeAsset?.universe?.szDecimals,
      });

      if (!previewMaxSize.isFinite() || previewMaxSize.lte(0)) {
        return null;
      }

      positionSize = positionSize.lte(previewMaxSize)
        ? positionSize
        : previewMaxSize;
      referencePrice = triggerReferencePrice;
    }

    if (
      !positionSize.isFinite() ||
      positionSize.lte(0) ||
      !referencePrice.isFinite() ||
      referencePrice.lte(0)
    ) {
      return null;
    }

    const totalValue = positionSize.multipliedBy(referencePrice);

    // Use unified function - it will automatically choose the optimal calculation path
    const _liquidationPrice = calculateLiquidationPrice({
      totalValue,
      referencePrice,
      clampToCurrentMark: !isTriggerMode,
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
    formData.executionPrice,
    formData.orderMode,
    formData.triggerOrderType,
    formData.triggerPrice,
    formData.triggerReduceOnly,
    orderReferencePrice,
    tradingComputed.computedSizeBN,
    leverage,
    activeAsset?.universe?.szDecimals,
    activeAssetData?.maxTradeSzs,
    activeAssetData?.leverage?.value,
    margin?.marginTiers,
    stableAccountValues.crossAccountValue,
    stableAccountValues.crossMaintenanceMarginUsed,
  ]);

  return liquidationPrice;
}
