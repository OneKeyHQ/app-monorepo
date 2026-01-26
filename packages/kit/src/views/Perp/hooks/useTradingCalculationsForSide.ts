import { useMemo } from 'react';

import { BigNumber } from 'bignumber.js';

import {
  useTradingFormAtom,
  useTradingFormComputedAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsActiveAssetAtom,
  usePerpsActiveAssetDataAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EPerpsSizeInputMode } from '@onekeyhq/shared/types/hyperliquid/types';

import { useLiquidationPrice } from './useLiquidationPrice';
import { useOrderPrice } from './useOrderPrice';

export function useTradingCalculationsForSide(side: 'long' | 'short') {
  const [formData] = useTradingFormAtom();
  const [tradingComputed] = useTradingFormComputedAtom();
  const [activeAsset] = usePerpsActiveAssetAtom();
  const [activeAssetData] = usePerpsActiveAssetDataAtom();

  const { price: effectivePriceBN, error: priceError } = useOrderPrice(side);
  const liquidationPrice = useLiquidationPrice(side);

  const leverage = useMemo(
    () => activeAssetData?.leverage?.value || 1,
    [activeAssetData?.leverage?.value],
  );

  const maxTradeSzBN = useMemo(() => {
    const maxTradeSzs = activeAssetData?.maxTradeSzs || [0, 0];
    return new BigNumber(maxTradeSzs[side === 'long' ? 0 : 1] ?? 0);
  }, [activeAssetData?.maxTradeSzs, side]);

  const markPxBN = useMemo(() => {
    const markPx = activeAssetData?.markPx;
    return new BigNumber(markPx ?? 0);
  }, [activeAssetData?.markPx]);

  // availableMargin = maxTradeSzs[side] * markPx / leverage
  const availableMarginBN = useMemo(() => {
    if (!maxTradeSzBN.gt(0) || !markPxBN.gt(0) || leverage <= 0) {
      return new BigNumber(0);
    }
    return maxTradeSzBN.multipliedBy(markPxBN).dividedBy(leverage);
  }, [maxTradeSzBN, markPxBN, leverage]);

  const availableToTrade = useMemo(
    () => ({
      display: availableMarginBN.toFixed(2, BigNumber.ROUND_DOWN),
      value: availableMarginBN.toNumber(),
    }),
    [availableMarginBN],
  );

  // maxPositionSize = availableMargin * leverage / effectivePrice
  const maxPositionSize = useMemo(() => {
    if (!effectivePriceBN.gt(0) || availableMarginBN.lte(0)) return 0;
    return availableMarginBN
      .multipliedBy(leverage)
      .dividedBy(effectivePriceBN)
      .toNumber();
  }, [effectivePriceBN, availableMarginBN, leverage]);

  const computedSizeForSide = useMemo(() => {
    const mode = formData.sizeInputMode ?? EPerpsSizeInputMode.MANUAL;

    if (mode !== EPerpsSizeInputMode.SLIDER) {
      return tradingComputed.computedSizeBN;
    }

    const percentValue = formData.sizePercent ?? 0;
    if (percentValue <= 0 || maxPositionSize <= 0) {
      return new BigNumber(0);
    }

    const sizeBN = new BigNumber(maxPositionSize)
      .multipliedBy(percentValue)
      .dividedBy(100);

    const szDecimals = activeAsset?.universe?.szDecimals ?? 2;
    return sizeBN.decimalPlaces(szDecimals, BigNumber.ROUND_DOWN);
  }, [
    formData.sizeInputMode,
    formData.sizePercent,
    tradingComputed.computedSizeBN,
    maxPositionSize,
    activeAsset?.universe?.szDecimals,
  ]);

  const orderValue = useMemo(
    () => computedSizeForSide.multipliedBy(effectivePriceBN),
    [computedSizeForSide, effectivePriceBN],
  );

  const marginRequired = useMemo(
    () => orderValue.dividedBy(leverage || 1),
    [orderValue, leverage],
  );

  const isNoEnoughMargin = useMemo(() => {
    if (
      !computedSizeForSide.isFinite() ||
      computedSizeForSide.lte(0) ||
      !effectivePriceBN.isFinite() ||
      effectivePriceBN.lte(0)
    ) {
      return false;
    }

    if (!availableMarginBN.isFinite() || availableMarginBN.lte(0)) {
      return true;
    }

    const requiredMargin = computedSizeForSide
      .multipliedBy(effectivePriceBN)
      .dividedBy(leverage || 1);

    return requiredMargin.isFinite() && requiredMargin.gt(availableMarginBN);
  }, [computedSizeForSide, effectivePriceBN, availableMarginBN, leverage]);

  return {
    computedSizeForSide,
    liquidationPrice,
    orderValue,
    marginRequired,
    availableToTrade,
    maxTradeSz: maxTradeSzBN.toNumber(),
    maxPositionSize,
    isNoEnoughMargin,
    leverage,
    effectivePriceBN,
    priceError,
  };
}
