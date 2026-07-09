import { BigNumber } from 'bignumber.js';

import { formatPriceToSignificantDigits } from '@onekeyhq/shared/src/utils/perpsUtils';

export interface IResolveTpSlTriggerPxInput {
  hasTpsl: boolean;
  tpType?: 'price' | 'percentage';
  tpValue?: string;
  slType?: 'price' | 'percentage';
  slValue?: string;
  // Entry/reference price the TP/SL percentages are anchored to.
  referencePrice: BigNumber;
  side: 'long' | 'short';
  leverage?: number;
}

export interface IResolveTpSlTriggerPxResult {
  tpTriggerPx?: string;
  slTriggerPx?: string;
}

// Extracted verbatim from useOrderConfirm so the chart popover and the main
// panel share one TP/SL conversion (keep them identical).
export function resolveTpSlTriggerPx({
  hasTpsl,
  tpType,
  tpValue,
  slType,
  slValue,
  referencePrice,
  side,
  leverage = 1,
}: IResolveTpSlTriggerPxInput): IResolveTpSlTriggerPxResult {
  const leverageBN = new BigNumber(leverage);
  if (!hasTpsl || !(tpValue || slValue)) {
    return {};
  }

  const entryPrice = referencePrice;

  let calculatedTpTriggerPx: BigNumber | null = null;
  let calculatedSlTriggerPx: BigNumber | null = null;

  if (tpValue) {
    const _tpValue = new BigNumber(tpValue);
    if (tpType === 'price') {
      calculatedTpTriggerPx = _tpValue;
    }
    if (tpType === 'percentage' && entryPrice.gt(0)) {
      const percentChange = entryPrice
        .multipliedBy(_tpValue)
        .dividedBy(100)
        .dividedBy(leverageBN);
      const tpPrice =
        side === 'long'
          ? entryPrice.plus(percentChange)
          : entryPrice.minus(percentChange);
      calculatedTpTriggerPx = tpPrice;
    }
  }

  if (slValue) {
    const _slValue = new BigNumber(slValue);
    if (slType === 'price') {
      calculatedSlTriggerPx = _slValue;
    }
    if (slType === 'percentage' && entryPrice.gt(0)) {
      const percentChange = entryPrice
        .multipliedBy(_slValue)
        .dividedBy(100)
        .dividedBy(leverageBN);
      const slPrice =
        side === 'long'
          ? entryPrice.minus(percentChange)
          : entryPrice.plus(percentChange);
      calculatedSlTriggerPx = slPrice;
    }
  }

  return {
    tpTriggerPx: calculatedTpTriggerPx
      ? formatPriceToSignificantDigits(calculatedTpTriggerPx)
      : '',
    slTriggerPx: calculatedSlTriggerPx
      ? formatPriceToSignificantDigits(calculatedSlTriggerPx)
      : '',
  };
}
