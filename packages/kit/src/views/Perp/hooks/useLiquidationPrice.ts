import { useMemo } from 'react';

import { BigNumber } from 'bignumber.js';

import type { ITradingFormData } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  useActiveTradeInstrumentAtom,
  useTradingFormAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsActiveAccountAtom,
  usePerpsActiveAssetAtom,
  usePerpsActiveAssetCtxAtom,
  usePerpsActiveAssetDataAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { estimateLiquidationPrice } from '@onekeyhq/shared/src/utils/perpsUtils';
import { ETriggerOrderType } from '@onekeyhq/shared/types/hyperliquid/types';

import { useOrderPrice } from './useOrderPrice';
import { usePerpsAccountScopedActivePositions } from './usePerpsAccountScopedActivePositions';
import { usePerpsCrossAvailableAfterMaintenance } from './usePerpsCrossAvailableAfterMaintenance';

export function useLiquidationPrice({
  side,
  size,
  formDataOverride,
}: {
  side: 'long' | 'short';
  // Size the order would be submitted with for this side.
  size: BigNumber;
  // Snapshot ticket (chart popover) that carries its own price.
  formDataOverride?: ITradingFormData;
}): BigNumber | null {
  const [atomFormData] = useTradingFormAtom();
  const formData = formDataOverride ?? atomFormData;
  const [activeTradeInstrument] = useActiveTradeInstrumentAtom();
  const [activeAccount] = usePerpsActiveAccountAtom();
  const [activeAsset] = usePerpsActiveAssetAtom();
  const [activeAssetCtx] = usePerpsActiveAssetCtxAtom();
  const [activeAssetData] = usePerpsActiveAssetDataAtom();
  const perpsPositions = usePerpsAccountScopedActivePositions();
  const { coin, margin } = activeAsset;
  const crossAvailableAfterMaintenance =
    usePerpsCrossAvailableAfterMaintenance(coin);
  const { price: formOrderPrice } = useOrderPrice(side);
  const overridePrice = formDataOverride?.price;
  const orderPrice = useMemo(
    () =>
      formDataOverride ? new BigNumber(overridePrice || 0) : formOrderPrice,
    [formDataOverride, formOrderPrice, overridePrice],
  );

  const currentCoinPosition = useMemo(
    () => perpsPositions.find((pos) => pos.position.coin === coin)?.position,
    [perpsPositions, coin],
  );

  return useMemo(() => {
    if (
      activeTradeInstrument.mode === 'spot' ||
      formData.orderMode === 'scale' ||
      formData.orderMode === 'twap'
    ) {
      return null;
    }
    const accountAddress = activeAccount?.accountAddress?.toLowerCase();
    const leverageType = activeAssetData?.leverage?.type;
    if (
      !accountAddress ||
      !activeAssetData ||
      activeAssetData.accountAddress?.toLowerCase() !== accountAddress ||
      activeAssetData.coin !== coin ||
      (leverageType !== 'cross' && leverageType !== 'isolated')
    ) {
      return null;
    }
    const leverage =
      activeAssetData.leverage.value || activeAsset?.universe?.maxLeverage;
    const markPrice = new BigNumber(activeAssetCtx?.ctx?.markPrice ?? 0);
    if (!leverage || !markPrice.isFinite() || markPrice.lte(0)) {
      return null;
    }

    let priceMode: 'market' | 'limit' =
      formData.type === 'market' ? 'market' : 'limit';
    let referencePrice = orderPrice;

    if (formData.orderMode === 'trigger') {
      // Match Hyperliquid's ordinary market/limit preview; the trigger price
      // controls activation only and does not enter the liquidation estimate.
      const isLimit =
        formData.triggerOrderType === ETriggerOrderType.TRIGGER_LIMIT;
      priceMode = isLimit ? 'limit' : 'market';
      if (isLimit) {
        referencePrice = new BigNumber(formData.executionPrice?.trim() || 0);
      }
    }

    if (!size.isFinite() || size.lte(0)) {
      return null;
    }

    const positionLeverage = currentCoinPosition?.leverage;
    const liquidationPrice = estimateLiquidationPrice({
      side,
      orderSize: size,
      priceMode,
      orderPrice: referencePrice,
      markPrice,
      reduceOnly:
        formData.orderMode === 'trigger'
          ? Boolean(formData.triggerReduceOnly)
          : formData.orderMode === 'standard' && Boolean(formData.reduceOnly),
      marginMode: leverageType,
      leverage,
      marginTiers: margin?.marginTiers,
      maxLeverage: activeAsset?.universe?.maxLeverage || 1,
      existingPositionSize: new BigNumber(currentCoinPosition?.szi ?? 0),
      isolatedRawUsd:
        positionLeverage?.type === 'isolated'
          ? new BigNumber(positionLeverage.rawUsd)
          : undefined,
      crossAvailableAfterMaintenance,
    });
    return liquidationPrice?.gt(0) ? liquidationPrice : null;
  }, [
    activeAccount?.accountAddress,
    activeAsset?.universe?.maxLeverage,
    activeAssetCtx?.ctx?.markPrice,
    activeAssetData,
    activeTradeInstrument.mode,
    coin,
    crossAvailableAfterMaintenance,
    currentCoinPosition,
    formData.executionPrice,
    formData.orderMode,
    formData.reduceOnly,
    formData.triggerOrderType,
    formData.triggerReduceOnly,
    formData.type,
    margin?.marginTiers,
    orderPrice,
    side,
    size,
  ]);
}
