import BigNumber from 'bignumber.js';

import tokenRebaseUtils from '@onekeyhq/shared/src/utils/tokenRebaseUtils';
import { EQuoteShowTipType } from '@onekeyhq/shared/types/swap/types';
import type { IQuoteTip, ISwapToken } from '@onekeyhq/shared/types/swap/types';

const QUOTE_SHOW_TIP_DEFAULT_PRICE_IMPACT_LOSS_THRESHOLD = 30;

function toValidBigNumber(value?: string | number) {
  const valueBN = new BigNumber(value ?? '');

  return valueBN.isNaN() ? undefined : valueBN;
}

function getTokenFiatValue({
  token,
  amount,
  fiatValue,
}: {
  token?: ISwapToken;
  amount?: string;
  fiatValue?: string;
}) {
  if (fiatValue !== undefined) {
    const value = new BigNumber(fiatValue);
    return value.isFinite() && value.gt(0) ? value : undefined;
  }
  const priceBN = toValidBigNumber(token?.price);
  const amountBN = toValidBigNumber(
    tokenRebaseUtils.applyBalanceMultiplier({
      amount,
      balanceMultiplier: token?.balanceMultiplier,
    }),
  );

  if (!priceBN || !priceBN.gt(0) || !amountBN || !amountBN.gt(0)) {
    return undefined;
  }

  return amountBN.multipliedBy(priceBN);
}

function getActualPriceImpact({
  fromToken,
  toToken,
  fromAmount,
  toAmount,
  fromFiatValue,
}: {
  fromToken?: ISwapToken;
  toToken?: ISwapToken;
  fromAmount?: string;
  toAmount?: string;
  fromFiatValue?: string;
}) {
  const fromFiatValueBN = getTokenFiatValue({
    token: fromToken,
    amount: fromAmount,
    fiatValue: fromFiatValue,
  });
  const toFiatValueBN = getTokenFiatValue({
    token: toToken,
    amount: toAmount,
  });

  if (!fromFiatValueBN || !fromFiatValueBN.gt(0) || !toFiatValueBN) {
    return undefined;
  }

  const priceImpactBN = fromFiatValueBN
    .minus(toFiatValueBN)
    .dividedBy(fromFiatValueBN)
    .multipliedBy(100);

  return priceImpactBN.isNaN() ? undefined : priceImpactBN;
}

export function resolveQuoteShowTip({
  quoteShowTip,
  fromToken,
  toToken,
  fromAmount,
  toAmount,
  fromFiatValue,
}: {
  quoteShowTip?: IQuoteTip;
  fromToken?: ISwapToken;
  toToken?: ISwapToken;
  fromAmount?: string;
  toAmount?: string;
  fromFiatValue?: string;
}) {
  if (!quoteShowTip?.type) {
    return quoteShowTip;
  }

  if (quoteShowTip.type === EQuoteShowTipType.TRADE_UNKNOWN) {
    const fromFiatValueBN = getTokenFiatValue({
      token: fromToken,
      amount: fromAmount,
      fiatValue: fromFiatValue,
    });
    const toFiatValueBN = getTokenFiatValue({
      token: toToken,
      amount: toAmount,
    });

    return fromFiatValueBN && toFiatValueBN ? undefined : quoteShowTip;
  }

  if (quoteShowTip.type !== EQuoteShowTipType.PRICE_IMPACT) {
    return quoteShowTip;
  }

  const quotePriceImpactLossThresholdBN = toValidBigNumber(
    quoteShowTip.priceImpactLoss,
  );
  const priceImpactLossThresholdBN =
    quotePriceImpactLossThresholdBN &&
    !quotePriceImpactLossThresholdBN.isNegative()
      ? quotePriceImpactLossThresholdBN
      : new BigNumber(QUOTE_SHOW_TIP_DEFAULT_PRICE_IMPACT_LOSS_THRESHOLD);
  const actualPriceImpactBN = getActualPriceImpact({
    fromToken,
    toToken,
    fromAmount,
    toAmount,
    fromFiatValue,
  });

  if (!actualPriceImpactBN) {
    return quoteShowTip;
  }

  if (!actualPriceImpactBN.gt(priceImpactLossThresholdBN)) {
    return undefined;
  }

  return quoteShowTip;
}
