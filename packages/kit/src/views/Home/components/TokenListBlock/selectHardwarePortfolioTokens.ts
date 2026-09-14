import {
  computeFundedIds,
  computeNonZeroIds,
} from '@onekeyhq/kit-bg/src/states/jotai/contexts/tokenList/cellsPure/pure';
import { isTokenSelectorDappToken } from '@onekeyhq/shared/src/utils/tokenSelectorFilterUtils';
import type {
  IAccountToken,
  ICustomTokenItem,
  IHomeDefaultToken,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

export function selectHardwarePortfolioTokens({
  tokens,
  tokenMap,
  keepDefault,
  homeDefaultTokenMap,
  customTokens,
}: {
  tokens: IAccountToken[];
  tokenMap: Record<string, ITokenFiat>;
  keepDefault: boolean;
  homeDefaultTokenMap?: Record<string, IHomeDefaultToken>;
  customTokens?: ICustomTokenItem[];
}): IAccountToken[] {
  const tokenByKey = new Map(tokens.map((token) => [token.$key, token]));
  const nonZeroIds = new Set(
    computeNonZeroIds({
      customTokens,
      getFiat: (key) => tokenMap[key],
      getMeta: (key) => tokenByKey.get(key),
      homeDefaultTokenMap,
      ids: tokens.map((token) => token.$key),
      keepDefault,
    }),
  );

  return tokens.filter(
    (token) => nonZeroIds.has(token.$key) && !isTokenSelectorDappToken(token),
  );
}

export function countFundedHardwarePortfolioTokens({
  tokens,
  tokenMap,
}: {
  tokens: IAccountToken[];
  tokenMap: Record<string, ITokenFiat>;
}): number {
  return computeFundedIds({
    getFiat: (key) => tokenMap[key],
    ids: tokens.map((token) => token.$key),
  }).length;
}
