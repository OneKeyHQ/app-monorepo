import BigNumber from 'bignumber.js';

import { isStockQuoteInputAmountMatched } from '@onekeyhq/kit/src/views/Swap/utils/swapStockTradeControl';
import { stableStringify } from '@onekeyhq/shared/src/utils/stringUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  IFetchQuoteResult,
  ISwapLimitPriceInfo,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapDirectionType,
  ESwapQuoteKind,
  ESwapSlippageSegmentKey,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import { isSwapQuoteInputAmountMatched } from './quoteProgress';

type ISwapAmountInput = {
  value: string;
  isInput: boolean;
};

type ISwapQuoteSemanticIntentInput = {
  accountId?: string;
  accountNetworkId?: string;
  fromAmount: ISwapAmountInput;
  fromToken?: ISwapToken;
  limitSettings?: ISwapQuoteLimitSemanticSettings;
  protocol: ESwapTabSwitchType;
  receivingAddress?: string;
  slippage: {
    key: ESwapSlippageSegmentKey;
    value: number;
  };
  toAmount: ISwapAmountInput;
  toToken?: ISwapToken;
  userAddress?: string;
};

export type ISwapQuoteLimitSemanticSettings = Readonly<{
  expirationTime: number;
  limitPartiallyFillable: boolean;
  userMarketPriceRate?: string;
}>;

export function buildSwapQuoteLimitSemanticSettings({
  expirationTime,
  fromToken,
  limitPartiallyFillable,
  limitPriceUseRate,
  protocol,
  toToken,
}: {
  expirationTime: number | string;
  fromToken?: ISwapToken;
  limitPartiallyFillable: boolean;
  limitPriceUseRate: ISwapLimitPriceInfo;
  protocol: ESwapTabSwitchType;
  toToken?: ISwapToken;
}): ISwapQuoteLimitSemanticSettings | undefined {
  if (protocol !== ESwapTabSwitchType.LIMIT) {
    return undefined;
  }

  const isSelectedPair =
    Boolean(limitPriceUseRate.rate) &&
    equalTokenNoCaseSensitive({
      token1: limitPriceUseRate.fromToken,
      token2: fromToken,
    }) &&
    equalTokenNoCaseSensitive({
      token1: limitPriceUseRate.toToken,
      token2: toToken,
    });

  return {
    expirationTime: Number(expirationTime),
    limitPartiallyFillable,
    userMarketPriceRate: isSelectedPair ? limitPriceUseRate.rate : undefined,
  };
}

export function buildSwapQuoteLimitSemanticSettingsKey(
  limitSettings?: ISwapQuoteLimitSemanticSettings,
) {
  return stableStringify({ limitSettings });
}

export function getSwapQuoteKindForCurrentInput({
  protocol,
  toAmount,
}: Pick<ISwapQuoteSemanticIntentInput, 'protocol' | 'toAmount'>) {
  return protocol === ESwapTabSwitchType.LIMIT && toAmount.isInput
    ? ESwapQuoteKind.BUY
    : ESwapQuoteKind.SELL;
}

export function buildSwapQuoteSemanticIntent(
  input: ISwapQuoteSemanticIntentInput,
) {
  const kind = getSwapQuoteKindForCurrentInput(input);
  const inputAmount =
    kind === ESwapQuoteKind.BUY ? input.toAmount.value : input.fromAmount.value;
  const inputAmountBN = new BigNumber(inputAmount || '0');
  const slippageValue =
    input.slippage.key === ESwapSlippageSegmentKey.CUSTOM
      ? input.slippage.value
      : undefined;
  const limitSettings =
    input.protocol === ESwapTabSwitchType.LIMIT
      ? input.limitSettings
      : undefined;

  return {
    hasValidInput: Boolean(
      input.fromToken &&
      input.toToken &&
      inputAmountBN.isFinite() &&
      inputAmountBN.gt(0),
    ),
    inputAmount,
    key: stableStringify({
      accountId: input.accountId,
      accountNetworkId: input.accountNetworkId,
      fromToken: input.fromToken
        ? {
            contractAddress: input.fromToken.contractAddress,
            networkId: input.fromToken.networkId,
          }
        : undefined,
      inputAmount,
      kind,
      limitSettings,
      protocol: input.protocol,
      receivingAddress: input.receivingAddress,
      slippageKey: input.slippage.key,
      slippageValue,
      toToken: input.toToken
        ? {
            contractAddress: input.toToken.contractAddress,
            networkId: input.toToken.networkId,
          }
        : undefined,
      userAddress: input.userAddress,
    }),
    kind,
    limitSettingsKey: buildSwapQuoteLimitSemanticSettingsKey(limitSettings),
  };
}

export function getSwapQuoteAmountProjection({
  expectedKind,
  fromAmount,
  fromToken,
  quote,
  toAmount,
  toToken,
}: {
  expectedKind: ESwapQuoteKind;
  fromAmount: string;
  fromToken?: ISwapToken;
  quote?: IFetchQuoteResult;
  toAmount: string;
  toToken?: ISwapToken;
}):
  | {
      direction: ESwapDirectionType;
      value: string;
    }
  | undefined {
  const quoteKind = quote?.kind ?? ESwapQuoteKind.SELL;
  const inputAmountMatched =
    quote?.protocol === EProtocolOfExchange.STOCK
      ? isStockQuoteInputAmountMatched({ quote, fromAmount, toAmount })
      : isSwapQuoteInputAmountMatched({ quote, fromAmount, toAmount });
  if (
    !quote ||
    quoteKind !== expectedKind ||
    !equalTokenNoCaseSensitive({
      token1: fromToken,
      token2: quote.fromTokenInfo,
    }) ||
    !equalTokenNoCaseSensitive({
      token1: toToken,
      token2: quote.toTokenInfo,
    }) ||
    !inputAmountMatched
  ) {
    return undefined;
  }

  return quoteKind === ESwapQuoteKind.BUY
    ? {
        direction: ESwapDirectionType.FROM,
        value: quote.fromAmount ?? '',
      }
    : {
        direction: ESwapDirectionType.TO,
        value: quote.toAmount ?? '',
      };
}
