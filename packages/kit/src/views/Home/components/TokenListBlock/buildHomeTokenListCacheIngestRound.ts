import BigNumber from 'bignumber.js';

import type { IIngestRoundParams } from '@onekeyhq/kit-bg/src/services/ServiceTokenViewModel';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { isValidNumberValue } from '@onekeyhq/shared/src/utils/tokenValueUtils';
import type {
  IAccountToken,
  ICustomTokenItem,
  IHomeDefaultToken,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

function buildTokenKeys(tokens: IAccountToken[]): string {
  return tokens.map((token) => token.$key).join(',');
}

function sumFiatValueByTokens({
  tokens,
  tokenListMap,
}: {
  tokens: IAccountToken[];
  tokenListMap: Record<string, ITokenFiat>;
}): string {
  return tokens
    .reduce((total, token) => {
      const fiatValue = tokenListMap[token.$key]?.fiatValue;
      if (!isValidNumberValue(fiatValue)) {
        return total;
      }
      return total.plus(fiatValue);
    }, new BigNumber(0))
    .toFixed();
}

export function buildHomeTokenListCacheIngestRound({
  ownerKey,
  accountId,
  networkId,
  tokenList,
  smallBalanceTokenList,
  riskyTokenList,
  tokenListMap,
  smallBalanceTokenListMap = {},
  riskyTokenListMap = {},
  keepDefault,
  homeDefaultTokenMap,
  customTokens,
  source,
}: {
  ownerKey: string;
  accountId?: string;
  networkId?: string;
  tokenList: IAccountToken[];
  smallBalanceTokenList: IAccountToken[];
  riskyTokenList: IAccountToken[];
  tokenListMap: Record<string, ITokenFiat>;
  smallBalanceTokenListMap?: Record<string, ITokenFiat>;
  riskyTokenListMap?: Record<string, ITokenFiat>;
  keepDefault?: boolean;
  homeDefaultTokenMap?: Record<string, IHomeDefaultToken>;
  customTokens?: ICustomTokenItem[];
  source: IIngestRoundParams['source'];
}): IIngestRoundParams {
  const visibleTokenListMap = {
    ...tokenListMap,
    ...smallBalanceTokenListMap,
  };
  const rawKeys = [
    buildTokenKeys(tokenList),
    buildTokenKeys(smallBalanceTokenList),
    buildTokenKeys(riskyTokenList),
  ].join('_');

  return {
    ownerKey,
    orderedTokens: tokenList,
    smallBalanceTokens: smallBalanceTokenList,
    tokenListMap: visibleTokenListMap,
    aggregateTokensMap: {},
    ownedAggregateTokenListMap: {},
    smallBalanceFiatValue: sumFiatValueByTokens({
      tokens: smallBalanceTokenList,
      tokenListMap: visibleTokenListMap,
    }),
    storeData: { storeName: EJotaiContextStoreNames.homeTokenList },
    keepDefault,
    homeDefaultTokenMap,
    customTokens,
    riskyTokens: riskyTokenList,
    riskyMap: {
      ...riskyTokenListMap,
    },
    accountId,
    networkId,
    rawKeys,
    source,
  };
}
