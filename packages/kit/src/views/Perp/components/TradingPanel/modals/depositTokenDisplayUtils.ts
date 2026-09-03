import BigNumber from 'bignumber.js';

import { sortPerpsDepositTokensByFiatValue } from '@onekeyhq/kit-bg/src/services/ServiceWebviewPerp/utils/depositTokenListUtils';
import type { IPerpsDepositToken } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import { MIN_DEPOSIT_AMOUNT } from '@onekeyhq/shared/types/hyperliquid/perp.constants';

export function getPerpsDepositMinimumCheck({
  inputAmount,
  isUsdInput,
  tokenPrice,
  tokenDecimals,
}: {
  inputAmount: string;
  isUsdInput: boolean;
  tokenPrice?: string;
  tokenDecimals?: number;
}) {
  const tokenPriceBN = new BigNumber(tokenPrice || '0');
  if (!tokenPriceBN.isFinite() || tokenPriceBN.lte(0)) {
    return {
      value: false,
      minFromTokenAmount: '-',
    };
  }

  const inputAmountBN = new BigNumber(inputAmount || '0');
  const minimumFiatAmountBN = new BigNumber(MIN_DEPOSIT_AMOUNT);
  const inputFiatAmountBN = isUsdInput
    ? inputAmountBN
    : inputAmountBN.multipliedBy(tokenPriceBN);
  if (
    inputFiatAmountBN.isFinite() &&
    inputFiatAmountBN.gte(minimumFiatAmountBN)
  ) {
    return { value: true };
  }

  const minFromTokenAmount = minimumFiatAmountBN.dividedBy(tokenPriceBN);
  return {
    value: false,
    minFromTokenAmount: minFromTokenAmount
      .decimalPlaces(
        Math.min(Number(tokenDecimals ?? 0), 8),
        BigNumber.ROUND_UP,
      )
      .toFixed(),
  };
}

export function getPerpsDepositTokenDisplayList(
  tokensByNetwork: Record<string, IPerpsDepositToken[]>,
) {
  return sortPerpsDepositTokensByFiatValue(
    Object.values(tokensByNetwork).flat(),
  );
}

export function getPerpsDepositTokensIdentityKey(
  tokens?: IPerpsDepositToken[],
) {
  return (tokens ?? [])
    .map((token) => `${token.networkId}:${token.contractAddress.toLowerCase()}`)
    .join('|');
}

export function getPerpsDepositTokensWithDefaultFallback({
  walletTokens,
  defaultTokens,
}: {
  walletTokens: IPerpsDepositToken[];
  defaultTokens?: IPerpsDepositToken[];
}) {
  return walletTokens.length > 0 ? walletTokens : (defaultTokens ?? []);
}

export function shouldPreservePerpsDepositSelectedToken({
  depositTokenListSource,
  currentToken,
  tokens,
}: {
  depositTokenListSource?: 'serverConfig' | 'walletBalance';
  currentToken?: IPerpsDepositToken;
  tokens: IPerpsDepositToken[];
}) {
  return (
    depositTokenListSource === 'walletBalance' &&
    tokens.some((token) =>
      equalTokenNoCaseSensitive({
        token1: token,
        token2: currentToken,
      }),
    )
  );
}

export function shouldUsePerpsDepositLiveWalletTokens({
  atomOwnerKey,
  routeOwnerKey,
  depositTokenListSource,
}: {
  atomOwnerKey?: string;
  routeOwnerKey?: string;
  depositTokenListSource?: 'serverConfig' | 'walletBalance';
}) {
  return (
    Boolean(routeOwnerKey) &&
    atomOwnerKey === routeOwnerKey &&
    depositTokenListSource === 'walletBalance'
  );
}

export function shouldShowPerpsDepositTokenSkeleton({
  selectedAction,
  checkAccountSupport,
  hasLoadedDepositTokenBalances,
  depositTokensWithPriceLength,
  hasDisplayDepositToken,
}: {
  selectedAction: 'deposit' | 'withdraw';
  checkAccountSupport: boolean;
  hasLoadedDepositTokenBalances: boolean;
  depositTokensWithPriceLength: number;
  hasDisplayDepositToken: boolean;
}) {
  return (
    selectedAction === 'deposit' &&
    checkAccountSupport &&
    !hasLoadedDepositTokenBalances &&
    depositTokensWithPriceLength === 0 &&
    !hasDisplayDepositToken
  );
}

export function arePerpsDepositSelectedTokenRefreshFieldsEqual({
  currentToken,
  nextToken,
}: {
  currentToken?: IPerpsDepositToken;
  nextToken: IPerpsDepositToken;
}) {
  return (
    equalTokenNoCaseSensitive({
      token1: currentToken,
      token2: nextToken,
    }) &&
    currentToken?.name === nextToken.name &&
    currentToken?.symbol === nextToken.symbol &&
    currentToken?.decimals === nextToken.decimals &&
    currentToken?.networkLogoURI === nextToken.networkLogoURI &&
    currentToken?.logoURI === nextToken.logoURI &&
    currentToken?.isNative === nextToken.isNative &&
    currentToken?.balanceParsed === nextToken.balanceParsed &&
    currentToken?.fiatValue === nextToken.fiatValue &&
    currentToken?.price === nextToken.price
  );
}

export function mergePerpsDepositTokensPreservingOrder({
  currentTokens,
  nextTokens,
}: {
  currentTokens: IPerpsDepositToken[];
  nextTokens: IPerpsDepositToken[];
}) {
  const hasRefreshedFiatValues = nextTokens.some(
    (token) => token.fiatValue !== undefined,
  );
  if (hasRefreshedFiatValues || currentTokens.length === 0) {
    return nextTokens;
  }

  const usedNextTokenIndexes = new Set<number>();
  const mergedTokens = currentTokens.reduce<IPerpsDepositToken[]>(
    (memo, currentToken) => {
      const nextTokenIndex = nextTokens.findIndex((nextToken, index) => {
        if (usedNextTokenIndexes.has(index)) {
          return false;
        }
        return equalTokenNoCaseSensitive({
          token1: currentToken,
          token2: nextToken,
        });
      });

      if (nextTokenIndex === -1) {
        return memo;
      }

      usedNextTokenIndexes.add(nextTokenIndex);
      memo.push(nextTokens[nextTokenIndex]);
      return memo;
    },
    [],
  );

  const appendedTokens = nextTokens.filter(
    (_, index) => !usedNextTokenIndexes.has(index),
  );
  return [...mergedTokens, ...appendedTokens];
}
