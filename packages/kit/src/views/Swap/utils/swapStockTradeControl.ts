import BigNumber from 'bignumber.js';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  IFetchQuoteResult,
  ISwapToken,
  ISwapTokenBase,
} from '@onekeyhq/shared/types/swap/types';
import { ESwapQuoteKind } from '@onekeyhq/shared/types/swap/types';

import type { IntlShape } from 'react-intl';

export type IStockQuoteTradeControl = {
  message: string;
  reason: 'limit' | 'error';
};

export function isSameStockTradeAmount({
  left,
  right,
}: {
  left?: string;
  right?: string;
}) {
  const leftBN = new BigNumber(left ?? '');
  const rightBN = new BigNumber(right ?? '');
  return leftBN.isFinite() && rightBN.isFinite() && leftBN.eq(rightBN);
}

export function isStockQuoteInputAmountMatched({
  fromAmount,
  quote,
  toAmount,
}: {
  fromAmount: string;
  quote?: Pick<IFetchQuoteResult, 'kind' | 'fromAmount' | 'toAmount'>;
  toAmount: string;
}) {
  if (!quote) {
    return false;
  }
  return isSameStockTradeAmount(
    quote.kind === ESwapQuoteKind.BUY
      ? {
          left: quote.toAmount,
          right: toAmount,
        }
      : {
          left: quote.fromAmount,
          right: fromAmount,
        },
  );
}

export function isQuoteResultForStockTrade({
  quoteResult,
  receiveToken,
  sendAmount,
  sendToken,
}: {
  quoteResult?: IFetchQuoteResult;
  receiveToken?: ISwapTokenBase;
  sendAmount?: string;
  sendToken?: ISwapToken;
}) {
  if (
    !quoteResult ||
    !equalTokenNoCaseSensitive({
      token1: quoteResult.fromTokenInfo,
      token2: sendToken,
    }) ||
    !equalTokenNoCaseSensitive({
      token1: quoteResult.toTokenInfo,
      token2: receiveToken,
    })
  ) {
    return false;
  }

  if (!quoteResult.fromAmount) {
    return false;
  }

  return isSameStockTradeAmount({
    left: quoteResult.fromAmount,
    right: sendAmount,
  });
}

export function getStockQuoteTradeControl({
  quoteResult,
  fromTokenAmount,
  fromTokenSymbol,
  intl,
}: {
  quoteResult?: IFetchQuoteResult;
  fromTokenAmount?: string;
  fromTokenSymbol?: string;
  intl: IntlShape;
}): IStockQuoteTradeControl | undefined {
  const fromAmountBN = new BigNumber(fromTokenAmount ?? 0);
  const resolvedFromTokenSymbol =
    quoteResult?.fromTokenInfo?.symbol ?? fromTokenSymbol;

  if (
    quoteResult?.limit &&
    !fromAmountBN.isNaN() &&
    fromAmountBN.gt(0) &&
    resolvedFromTokenSymbol
  ) {
    if (quoteResult.limit.min) {
      const minBN = new BigNumber(quoteResult.limit.min);
      if (!minBN.isNaN() && fromAmountBN.lt(minBN)) {
        return {
          message: intl.formatMessage(
            { id: ETranslations.provider_min_amount_required },
            {
              amount: numberFormat(quoteResult.limit.min, {
                formatter: 'balance',
              }),
              token: resolvedFromTokenSymbol,
            },
          ),
          reason: 'limit',
        };
      }
    }

    if (quoteResult.limit.max) {
      const maxBN = new BigNumber(quoteResult.limit.max);
      if (!maxBN.isNaN() && fromAmountBN.gt(maxBN)) {
        return {
          message: intl.formatMessage(
            { id: ETranslations.provider_max_amount_required },
            {
              amount: numberFormat(quoteResult.limit.max, {
                formatter: 'balance',
              }),
              token: resolvedFromTokenSymbol,
            },
          ),
          reason: 'limit',
        };
      }
    }
  }

  if (quoteResult?.errorMessage) {
    return {
      message: quoteResult.errorMessage,
      reason: 'error',
    };
  }

  return undefined;
}
