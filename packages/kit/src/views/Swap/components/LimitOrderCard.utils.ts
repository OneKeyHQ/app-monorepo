import BigNumber from 'bignumber.js';

import { clampLimitRateDecimals } from '@onekeyhq/shared/src/utils/numberUtils';
import type { IFetchLimitOrderRes } from '@onekeyhq/shared/types/swap/types';

import { getSwapDisplayAmount } from '../utils/swapAmountUtils';

type ILimitOrderDisplayAmountInput = {
  executedBuyAmount?: IFetchLimitOrderRes['executedBuyAmount'];
  executedSellAmount?: IFetchLimitOrderRes['executedSellAmount'];
  fromAmount?: IFetchLimitOrderRes['fromAmount'];
  fromTokenInfo?: Pick<
    IFetchLimitOrderRes['fromTokenInfo'],
    'decimals' | 'balanceMultiplier'
  >;
  toAmount?: IFetchLimitOrderRes['toAmount'];
  toTokenInfo?: Pick<
    IFetchLimitOrderRes['toTokenInfo'],
    'decimals' | 'balanceMultiplier'
  >;
};

export function getLimitOrderDisplayAmounts({
  executedBuyAmount,
  executedSellAmount,
  fromAmount,
  fromTokenInfo,
  toAmount,
  toTokenInfo,
}: ILimitOrderDisplayAmountInput) {
  const executedBuyAmountBN = new BigNumber(executedBuyAmount ?? '0');
  const executedSellAmountBN = new BigNumber(executedSellAmount ?? '0');
  const shouldUseExecutedAmounts =
    executedBuyAmountBN.isFinite() &&
    executedBuyAmountBN.gt(0) &&
    executedSellAmountBN.isFinite() &&
    executedSellAmountBN.gt(0);
  const displayFromAmount = shouldUseExecutedAmounts
    ? (executedSellAmount ?? '0')
    : (fromAmount ?? '0');
  const displayToAmount = shouldUseExecutedAmounts
    ? (executedBuyAmount ?? '0')
    : (toAmount ?? '0');

  return {
    displayFromAmount: new BigNumber(
      getSwapDisplayAmount(
        new BigNumber(displayFromAmount)
          .shiftedBy(-(fromTokenInfo?.decimals ?? 0))
          .toFixed(),
        fromTokenInfo?.balanceMultiplier,
      ) ?? 'NaN',
    ),
    displayToAmount: new BigNumber(
      getSwapDisplayAmount(
        new BigNumber(displayToAmount)
          .shiftedBy(-(toTokenInfo?.decimals ?? 0))
          .toFixed(),
        toTokenInfo?.balanceMultiplier,
      ) ?? 'NaN',
    ),
  };
}

type ILimitOrderDisplayPriceInput = {
  // Human-unit amounts (already shifted by token decimals).
  fromAmount: BigNumber;
  toAmount: BigNumber;
  fromTokenDecimals?: number;
  toTokenDecimals?: number;
  reverse?: boolean;
  fromMultiplier?: string;
  toMultiplier?: string;
};

// The displayed limit price of an order, shared by LimitOrderCard and
// LimitOrderDetailModal so both surfaces show the same number. The rate is
// aligned to the decimals of the token it is denominated in, via
// clampLimitRateDecimals so ultra-small rates (many-leading-zeros tokens)
// keep their significant digits instead of collapsing to "0". Degenerate
// orders (a zero side would divide to Infinity/NaN) display as 0.
export function getLimitOrderDisplayPrice({
  fromAmount,
  toAmount,
  fromTokenDecimals,
  toTokenDecimals,
  reverse,
  fromMultiplier,
  toMultiplier,
}: ILimitOrderDisplayPriceInput): BigNumber {
  const displayFromAmount = new BigNumber(
    getSwapDisplayAmount(fromAmount.toFixed(), fromMultiplier) ?? 'NaN',
  );
  const displayToAmount = new BigNumber(
    getSwapDisplayAmount(toAmount.toFixed(), toMultiplier) ?? 'NaN',
  );
  const price = reverse
    ? clampLimitRateDecimals(
        displayFromAmount.div(displayToAmount),
        fromTokenDecimals,
      )
    : clampLimitRateDecimals(
        displayToAmount.div(displayFromAmount),
        toTokenDecimals,
      );
  return price.isFinite() ? price : new BigNumber(0);
}
