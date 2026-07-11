import BigNumber from 'bignumber.js';

import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  IFetchQuotesParams,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapQuoteKind,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

type ISwapQuoteActionIdentity = {
  type?: ESwapTabSwitchType;
  actionLock: boolean;
  fromToken?: ISwapToken;
  toToken?: ISwapToken;
  fromTokenAmount?: string;
  toTokenAmount?: string;
  accountId?: string;
  kind?: ESwapQuoteKind;
  address?: string;
  receivingAddress?: string;
};

export function isStockProtocol(protocol?: string) {
  return (
    protocol === ESwapTabSwitchType.STOCK ||
    protocol === EProtocolOfExchange.STOCK
  );
}

export function isSameSwapAmountValue({
  currentAmount,
  eventAmount,
}: {
  currentAmount?: string;
  eventAmount?: string;
}) {
  if (eventAmount === undefined) {
    return true;
  }
  const normalizedCurrentAmount = currentAmount ?? '';
  if (!eventAmount && !normalizedCurrentAmount) {
    return true;
  }
  const eventAmountBN = new BigNumber(eventAmount);
  const currentAmountBN = new BigNumber(normalizedCurrentAmount);
  if (
    eventAmountBN.isFinite() &&
    !eventAmountBN.isNaN() &&
    currentAmountBN.isFinite() &&
    !currentAmountBN.isNaN()
  ) {
    return eventAmountBN.eq(currentAmountBN);
  }
  return eventAmount === normalizedCurrentAmount;
}

export function isSameQuoteActionIdentity({
  actionLock,
  accountId,
  address,
  fromToken,
  inputAmount,
  kind,
  receivingAddress,
  swapType,
  toToken,
}: {
  actionLock: ISwapQuoteActionIdentity;
  accountId?: string;
  address?: string;
  fromToken?: ISwapToken;
  inputAmount?: string;
  kind?: ESwapQuoteKind;
  receivingAddress?: string;
  swapType: ESwapTabSwitchType;
  toToken?: ISwapToken;
}) {
  const lockedInputAmount =
    kind === ESwapQuoteKind.BUY
      ? actionLock.toTokenAmount
      : actionLock.fromTokenAmount;
  return (
    actionLock.actionLock &&
    actionLock.type === swapType &&
    actionLock.kind === kind &&
    equalTokenNoCaseSensitive({
      token1: actionLock.fromToken,
      token2: fromToken,
    }) &&
    equalTokenNoCaseSensitive({
      token1: actionLock.toToken,
      token2: toToken,
    }) &&
    isSameSwapAmountValue({
      currentAmount: lockedInputAmount,
      eventAmount: inputAmount,
    }) &&
    actionLock.accountId === accountId &&
    actionLock.address === address &&
    actionLock.receivingAddress === receivingAddress
  );
}

function isQuoteProtocolForSwapType({
  protocol,
  swapType,
}: {
  protocol: string;
  swapType: ESwapTabSwitchType;
}) {
  if (swapType === ESwapTabSwitchType.STOCK) {
    return isStockProtocol(protocol);
  }
  if (swapType === ESwapTabSwitchType.LIMIT) {
    return (
      protocol === ESwapTabSwitchType.LIMIT ||
      protocol === EProtocolOfExchange.LIMIT
    );
  }
  if (swapType === ESwapTabSwitchType.PRIVATE_SEND) {
    return (
      protocol === ESwapTabSwitchType.PRIVATE_SEND ||
      protocol === EProtocolOfExchange.PRIVATE_SEND
    );
  }
  return (
    protocol === ESwapTabSwitchType.SWAP ||
    protocol === ESwapTabSwitchType.BRIDGE ||
    protocol === EProtocolOfExchange.SWAP
  );
}

export function isCurrentQuoteEventParams({
  actionLock,
  accountId,
  currentSwapType,
  fromToken,
  fromTokenAmount,
  params,
  toToken,
  toTokenAmount,
  tokenPairs,
}: {
  actionLock: ISwapQuoteActionIdentity;
  accountId?: string;
  currentSwapType: ESwapTabSwitchType;
  fromToken?: ISwapToken;
  fromTokenAmount?: string;
  params: IFetchQuotesParams;
  toToken?: ISwapToken;
  toTokenAmount?: string;
  tokenPairs: { fromToken: ISwapToken; toToken: ISwapToken };
}) {
  const isSameTokenPair =
    equalTokenNoCaseSensitive({
      token1: tokenPairs.fromToken,
      token2: fromToken,
    }) &&
    equalTokenNoCaseSensitive({
      token1: tokenPairs.toToken,
      token2: toToken,
    });
  const isSameFromAmount = isSameSwapAmountValue({
    currentAmount: fromTokenAmount,
    eventAmount: params.fromTokenAmount,
  });
  if (isStockProtocol(params.protocol)) {
    return (
      currentSwapType === ESwapTabSwitchType.STOCK &&
      isSameTokenPair &&
      isSameFromAmount
    );
  }

  const isBuyQuote = params.kind === ESwapQuoteKind.BUY;
  const eventInputAmount = isBuyQuote
    ? params.toTokenAmount
    : params.fromTokenAmount;
  return (
    isQuoteProtocolForSwapType({
      protocol: params.protocol,
      swapType: currentSwapType,
    }) &&
    isSameTokenPair &&
    isSameQuoteActionIdentity({
      actionLock,
      accountId,
      address: params.userAddress,
      fromToken: tokenPairs.fromToken,
      inputAmount: eventInputAmount,
      kind: params.kind,
      receivingAddress: params.receivingAddress,
      swapType: currentSwapType,
      toToken: tokenPairs.toToken,
    }) &&
    isSameSwapAmountValue({
      currentAmount: isBuyQuote ? toTokenAmount : fromTokenAmount,
      eventAmount: eventInputAmount,
    })
  );
}
