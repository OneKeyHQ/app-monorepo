import type { PropsWithChildren } from 'react';
import { createContext, useCallback, useContext, useMemo } from 'react';

import {
  useSmallBalanceTokenListAtom,
  useSmallBalanceTokenListMapAtom,
  useTokenListAtom,
  useTokenListMapAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/tokenList';
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
  const [tokenList] = useTokenListAtom();
  const [smallBalanceTokenList] = useSmallBalanceTokenListAtom();
  const [tokenListMap] = useTokenListMapAtom();
  const [smallBalanceTokenListMap] = useSmallBalanceTokenListMapAtom();

  const context = useMemo<ITokenDataContextTypes>(
    () => ({
      tokensMap: buildAccountTokenMap({
        tokens: initialTokens.concat([
          ...tokenList.tokens,
          ...smallBalanceTokenList.smallBalanceTokens,
        ]),
      }),
      fiatMap: {
        ...initialMap,
        ...tokenListMap,
        ...smallBalanceTokenListMap,
      },
      networkId,
      accountId,
    }),
    [
      initialTokens,
      tokenList.tokens,
      smallBalanceTokenList.smallBalanceTokens,
      initialMap,
      tokenListMap,
      smallBalanceTokenListMap,
      networkId,
      accountId,
    ],
  );

  return (
    <TokenDataContext.Provider value={context}>
      {children}
    </TokenDataContext.Provider>
  );
}
