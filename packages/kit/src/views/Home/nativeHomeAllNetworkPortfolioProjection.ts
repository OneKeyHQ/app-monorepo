import {
  buildSelectorTokenListFromResponses,
  mergeDeriveTokenList,
  mergeDeriveTokenListMap,
  sortTokensByFiatValue,
} from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  IAccountToken,
  IAggregateToken,
  IFetchAccountTokensResp,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

export interface INativeHomeAllNetworkPortfolioProjection {
  map: Record<string, ITokenFiat>;
  riskMap: Record<string, ITokenFiat>;
  riskTokens: IAccountToken[];
  smallBalanceMap: Record<string, ITokenFiat>;
  smallBalanceTokens: IAccountToken[];
  tokens: IAccountToken[];
}

export type INativeHomeAllNetworkTokenResponse = IFetchAccountTokensResp & {
  mergeDeriveAssets?: boolean;
};

function dedupeTokenIdentity(tokens: IAccountToken[]): IAccountToken[] {
  const seenKeys = new Set<string>();

  return tokens.filter((token) => {
    if (seenKeys.has(token.$key)) {
      return false;
    }
    seenKeys.add(token.$key);
    return true;
  });
}

function buildRiskProjection(responses: INativeHomeAllNetworkTokenResponse[]) {
  let riskTokens: IAccountToken[] = [];
  let riskMap: Record<string, ITokenFiat> = {};
  const responsesByNetwork = new Map<
    string,
    INativeHomeAllNetworkTokenResponse[]
  >();

  responses.forEach((response, index) => {
    const networkKey = response.networkId ?? `unknown:${index}`;
    const group = responsesByNetwork.get(networkKey);
    if (group) {
      group.push(response);
    } else {
      responsesByNetwork.set(networkKey, [response]);
    }
  });

  responsesByNetwork.forEach((group) => {
    const mergeDeriveAssets = group[0]?.mergeDeriveAssets ?? false;
    group.forEach((response) => {
      riskTokens = mergeDeriveTokenList({
        sourceTokens: response.riskTokens.data,
        targetTokens: riskTokens,
        mergeDeriveAssets,
      });
      riskMap = mergeDeriveTokenListMap({
        sourceMap: response.riskTokens.map,
        targetMap: riskMap,
        mergeDeriveAssets,
      });
    });
  });

  return {
    riskMap,
    riskTokens: sortTokensByFiatValue({
      tokens: dedupeTokenIdentity(riskTokens),
      map: riskMap,
    }),
  };
}

function pickTokenMap(
  tokens: IAccountToken[],
  source: Record<string, ITokenFiat>,
): Record<string, ITokenFiat> {
  return Object.fromEntries(
    tokens.flatMap((token) => {
      const fiat = source[token.$key];
      return fiat ? [[token.$key, fiat] as const] : [];
    }),
  );
}

export function buildNativeHomeAllNetworkPortfolioProjection({
  responses,
  aggregateTokenConfigMapRawData,
}: {
  responses: INativeHomeAllNetworkTokenResponse[];
  aggregateTokenConfigMapRawData?: Record<string, IAggregateToken>;
}): INativeHomeAllNetworkPortfolioProjection {
  const normalizedResponses = responses.map((response) => {
    const stampTokens = (tokens: IAccountToken[]) =>
      tokens.map((token) => ({
        ...token,
        mergeAssets: Boolean(response.mergeDeriveAssets && token.mergeAssets),
      }));
    return {
      ...response,
      tokens: { ...response.tokens, data: stampTokens(response.tokens.data) },
      smallBalanceTokens: {
        ...response.smallBalanceTokens,
        data: stampTokens(response.smallBalanceTokens.data),
      },
      riskTokens: {
        ...response.riskTokens,
        data: stampTokens(response.riskTokens.data),
      },
    };
  });
  const regular = buildSelectorTokenListFromResponses({
    responses: normalizedResponses,
    aggregateTokenConfigMapRawData,
  });
  const risk = buildRiskProjection(normalizedResponses);
  const highValueKeys = new Set(regular.tokens.map((token) => token.$key));
  const regularTokens = dedupeTokenIdentity([
    ...regular.tokens,
    ...regular.smallBalanceTokens,
  ]);
  const tokens = regularTokens.filter((token) => highValueKeys.has(token.$key));
  const smallBalanceTokens = regularTokens.filter(
    (token) => !highValueKeys.has(token.$key),
  );
  const regularMap = {
    ...regular.tokenListMap,
    ...regular.aggregateTokenFiatMap,
  };

  return {
    map: pickTokenMap(tokens, regularMap),
    tokens,
    riskMap: pickTokenMap(risk.riskTokens, risk.riskMap),
    riskTokens: risk.riskTokens,
    smallBalanceMap: pickTokenMap(smallBalanceTokens, regularMap),
    smallBalanceTokens,
  };
}
