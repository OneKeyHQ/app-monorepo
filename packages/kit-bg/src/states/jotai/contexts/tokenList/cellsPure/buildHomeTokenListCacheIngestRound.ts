import type { IIngestRoundParams } from '@onekeyhq/kit-bg/src/services/ServiceTokenViewModel';
import { sumFiatValuesFromTokens } from '@onekeyhq/shared/src/utils/tokenValueUtils';
import type {
  IAccountToken,
  ICustomTokenItem,
  IHomeDefaultToken,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

import { EJotaiContextStoreNames } from '../../../atoms';

function buildTokenKeys(tokens: IAccountToken[]): string {
  return tokens.map((token) => token.$key).join(',');
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
    // Shared helper so shared-balance rows (Arc, OK-63633) flagged in the
    // cached fiat map are skipped exactly like the live rounds do.
    smallBalanceFiatValue: sumFiatValuesFromTokens(
      smallBalanceTokenList,
      visibleTokenListMap,
    ).toFixed(),
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
