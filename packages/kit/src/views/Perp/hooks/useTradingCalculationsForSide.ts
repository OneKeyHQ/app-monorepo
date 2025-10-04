import { useMemo } from 'react';

import { BigNumber } from 'bignumber.js';

import {
  useTradingFormAtom,
  useTradingFormComputedAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsActiveAssetAtom,
  usePerpsActiveAssetCtxAtom,
  usePerpsActiveAssetDataAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EPerpsSizeInputMode } from '@onekeyhq/shared/types/hyperliquid/types';

import { useLiquidationPrice } from './useLiquidationPrice';

export function useTradingCalculationsForSide(side: 'long' | 'short') {
  const [formData] = useTradingFormAtom();
  const [tradingComputed] = useTradingFormComputedAtom();
  const [activeAsset] = usePerpsActiveAssetAtom();
  const [activeAssetCtx] = usePerpsActiveAssetCtxAtom();
  const [activeAssetData] = usePerpsActiveAssetDataAtom();

  const liquidationPrice = useLiquidationPrice(side);

  const leverage = useMemo(() => {
    return activeAssetData?.leverage?.value || 1;
  }, [activeAssetData?.leverage?.value]);

  const effectivePriceBN = useMemo(() => {
    if (formData.type === 'limit') {
      return new BigNumber(formData.price || 0);
    }
    return new BigNumber(activeAssetCtx?.ctx?.markPrice || 0);
  }, [formData.type, formData.price, activeAssetCtx?.ctx?.markPrice]);

  const availableToTradeBN = useMemo(() => {
    const _availableToTrade = activeAssetData?.availableToTrade || [0, 0];
    const value = Number(_availableToTrade[side === 'long' ? 0 : 1] || 0);
    return new BigNumber(value);
  }, [side, activeAssetData?.availableToTrade]);

  const availableToTrade = useMemo(() => {
    return {
      display: availableToTradeBN.toFixed(2, BigNumber.ROUND_DOWN),
      value: availableToTradeBN.toNumber(),
    };
  }, [availableToTradeBN]);

  const maxTradeSzBN = useMemo(() => {
    const maxTradeSzs = activeAssetData?.maxTradeSzs || [0, 0];
    const value = Number(maxTradeSzs[side === 'long' ? 0 : 1]);
    return new BigNumber(value);
  }, [activeAssetData?.maxTradeSzs, side]);

  const maxPositionSize = useMemo(() => {
    if (!effectivePriceBN.gt(0) || availableToTradeBN.lte(0)) return 0;

    const maxSizeFromBalance = availableToTradeBN
      .multipliedBy(leverage)
      .dividedBy(effectivePriceBN)
      .toNumber();

    const maxSizeFromLimit = maxTradeSzBN.toNumber();

    return Math.min(maxSizeFromBalance, maxSizeFromLimit);
  }, [effectivePriceBN, availableToTradeBN, leverage, maxTradeSzBN]);

  const computedSizeForSide = useMemo(() => {
    const mode = formData.sizeInputMode ?? EPerpsSizeInputMode.MANUAL;

    if (mode !== EPerpsSizeInputMode.SLIDER) {
      return tradingComputed.computedSizeBN;
    }

    const percentValue = formData.sizePercent ?? 0;
    if (percentValue <= 0) {
      return new BigNumber(0);
    }

    if (!effectivePriceBN.gt(0) || availableToTradeBN.lte(0)) {
      return new BigNumber(0);
    }

    const maxSizeBN = availableToTradeBN
      .multipliedBy(leverage)
      .dividedBy(effectivePriceBN);

    if (!maxSizeBN.isFinite() || maxSizeBN.lte(0)) {
      return new BigNumber(0);
    }

    const percentBN = new BigNumber(percentValue);
    const sizeBN = maxSizeBN.multipliedBy(percentBN).dividedBy(100);

    const szDecimals = activeAsset?.universe?.szDecimals ?? 2;
    return sizeBN.decimalPlaces(szDecimals, BigNumber.ROUND_DOWN);
  }, [
    formData.sizeInputMode,
    formData.sizePercent,
    tradingComputed.computedSizeBN,
    effectivePriceBN,
    availableToTradeBN,
    leverage,
    activeAsset?.universe?.szDecimals,
  ]);

  const orderValue = useMemo(() => {
    return computedSizeForSide.multipliedBy(effectivePriceBN);
  }, [computedSizeForSide, effectivePriceBN]);

  const marginRequired = useMemo(() => {
    return orderValue.dividedBy(leverage || 1);
  }, [orderValue, leverage]);

  const isNoEnoughMargin = useMemo(() => {
    if (
      !computedSizeForSide.isFinite() ||
      computedSizeForSide.lte(0) ||
      !effectivePriceBN.isFinite() ||
      effectivePriceBN.lte(0)
    ) {
      return false;
    }

    if (!availableToTradeBN.isFinite() || availableToTradeBN.lte(0)) {
      return true;
    }

    const leverageBN = new BigNumber(leverage || 1);
    const safeLeverage =
      leverageBN.isFinite() && leverageBN.gt(0) ? leverageBN : new BigNumber(1);

    const requiredMargin = computedSizeForSide
      .multipliedBy(effectivePriceBN)
      .dividedBy(safeLeverage);

    if (!requiredMargin.isFinite()) return false;

    return requiredMargin.gt(availableToTradeBN);
  }, [computedSizeForSide, effectivePriceBN, availableToTradeBN, leverage]);

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
  };
}
