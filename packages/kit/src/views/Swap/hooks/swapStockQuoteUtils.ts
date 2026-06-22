import BigNumber from 'bignumber.js';

import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  IFetchQuoteResult,
  ISwapToken,
  ISwapTokenBase,
} from '@onekeyhq/shared/types/swap/types';

function isSameAmount({ left, right }: { left?: string; right?: string }) {
  const leftBN = new BigNumber(left ?? '');
  const rightBN = new BigNumber(right ?? '');
  return leftBN.isFinite() && rightBN.isFinite() && leftBN.eq(rightBN);
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

  return isSameAmount({
    left: quoteResult.fromAmount,
    right: sendAmount,
  });
}
