import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  IFetchQuoteResult,
  ISwapTokenBase,
} from '@onekeyhq/shared/types/swap/types';

export function getSwapQuoteTokenRisk({
  quote,
  fromToken,
  toToken,
  isLoading,
  hasQuoteError,
}: {
  quote?: IFetchQuoteResult;
  fromToken?: ISwapTokenBase;
  toToken?: ISwapTokenBase;
  isLoading?: boolean;
  hasQuoteError?: boolean;
}): 'honeypot' | 'lowLiquidity' | undefined {
  if (
    !quote ||
    isLoading ||
    hasQuoteError ||
    quote.errorMessage ||
    !fromToken ||
    !toToken ||
    !equalTokenNoCaseSensitive({
      token1: quote.fromTokenInfo,
      token2: fromToken,
    }) ||
    !equalTokenNoCaseSensitive({
      token1: quote.toTokenInfo,
      token2: toToken,
    })
  ) {
    return undefined;
  }
  if (quote.honeypot) {
    return 'honeypot';
  }
  return quote.lowLiquidity ? 'lowLiquidity' : undefined;
}
