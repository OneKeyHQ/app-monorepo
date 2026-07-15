import BigNumber from 'bignumber.js';

import { stableStringify } from '@onekeyhq/shared/src/utils/stringUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  IFetchQuoteResult,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import {
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
    !isSwapQuoteInputAmountMatched({
      quote,
      fromAmount,
      toAmount,
    })
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
