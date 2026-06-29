import type { PropsWithChildren } from 'react';
import { createContext, useCallback, useContext, useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';

const buildAccountTokenIndexKey = ({
  networkId,
  tokenAddress,
}: {
  tokenAddress: string;
  networkId?: string;
}): string => (networkId ? `${networkId}__${tokenAddress}` : '');

export function buildAccountTokenMap({
  tokens,
  lastResult = {},
}: {
  tokens: IAccountToken[];
  lastResult?: Record<string, IAccountToken>;
}) {
  const result = { ...lastResult };
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const indexKey = buildAccountTokenIndexKey({
      networkId: token.networkId,
      tokenAddress: token.address,
    });
    if (indexKey) {
      result[indexKey] = token;
    }
  }
  return result;
}

export type ITokenDataContextTypes = {
  tokensMap: Record<string, IAccountToken>;
  fiatMap: Record<string, ITokenFiat>;
  networkId: string;
  accountId?: string;
};

export type IUpdateTokenListParams = {
  tokens: IAccountToken[];
  map: Record<string, ITokenFiat>;
};

export const TokenDataContext = createContext<ITokenDataContextTypes>({
  tokensMap: {},
  fiatMap: {},
  networkId: '',
});

export const useTokenDataContext = () => {
  const {
    tokensMap,
    fiatMap,
    networkId: contextNetworkId,
  } = useContext(TokenDataContext);
  const getTokenFiatValue = useCallback(
    ({
      networkId,
      tokenAddress,
    }: {
      networkId: string;
      tokenAddress: string;
    }): ITokenFiat | undefined => {
      if (!networkUtils.isAllNetwork({ networkId: contextNetworkId })) {
        return undefined;
      }
      const indexKey = buildAccountTokenIndexKey({ networkId, tokenAddress });
      const tokenKey = tokensMap[indexKey]?.$key;
      const result = tokenKey ? fiatMap[tokenKey] : undefined;
      return result;
    },
    [tokensMap, fiatMap, contextNetworkId],
  );
  return { getTokenFiatValue, tokensMap, fiatMap };
};

export function TokenDataContainer({
  children,
  initialMap,
  initialTokens,
  networkId,
  accountId,
}: PropsWithChildren<{
  networkId: string;
  accountId?: string;
  initialTokens: IAccountToken[];
  initialMap: Record<string, ITokenFiat>;
}>) {
  // Read the owner's persisted local tokens directly instead of subscribing to
  // the home token-list context atoms. The home producer splits its cache into
  // regular / small-balance arrays plus two fiat maps; the persisted
  // local-tokens response already carries the same data — `tokenList` +
  // `smallBalanceTokenList` cover the displayed tokens, and `tokenListMap` is a
  // single `$key -> ITokenFiat` map spanning all of them. We merge that with
  // the route-param initial data the container receives.
  const { result: localTokens } = usePromiseResult(async () => {
    if (!accountId || !networkId) {
      return undefined;
    }
    return backgroundApiProxy.serviceToken.getAccountLocalTokens({
      accountId,
      networkId,
    });
  }, [accountId, networkId]);

  const context = useMemo<ITokenDataContextTypes>(() => {
    const localRegularTokens = localTokens?.tokenList ?? [];
    const localSmallBalanceTokens = localTokens?.smallBalanceTokenList ?? [];
    const localTokenListMap = localTokens?.tokenListMap ?? {};
    return {
      tokensMap: buildAccountTokenMap({
        tokens: initialTokens.concat([
          ...localRegularTokens,
          ...localSmallBalanceTokens,
        ]),
      }),
      fiatMap: {
        ...initialMap,
        ...localTokenListMap,
      },
      networkId,
      accountId,
    };
  }, [initialTokens, localTokens, initialMap, networkId, accountId]);

  return (
    <TokenDataContext.Provider value={context}>
      {children}
    </TokenDataContext.Provider>
  );
}
