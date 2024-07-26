import type { PropsWithChildren } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
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

export const useGetTokenFiatValue = () => {
  const {
    tokensMap,
    fiatMap,
    networkId: contextNetworkId,
  } = useContext(TokenDataContext);
  return useCallback(
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
};

export function TokenDataContainer({
  children,
  initialMap,
  initialTokens,
  networkId,
}: PropsWithChildren<{
  networkId: string;
  initialTokens: IAccountToken[];
  initialMap: Record<string, ITokenFiat>;
}>) {
  const [accountTokensMap, setAccountTokensMap] = useState<
    Record<string, IAccountToken>
  >(() => buildAccountTokenMap({ tokens: initialTokens }));
  const [tokenFiatMap, setTokenFiatMap] =
    useState<Record<string, ITokenFiat>>(initialMap);
  const updateTokenList = useCallback(
    ({ map, tokens }: IUpdateTokenListParams) => {
      setTokenFiatMap((prev) => ({ ...prev, ...map }));
      setAccountTokensMap((lastTokensMap) =>
        buildAccountTokenMap({ tokens, lastResult: lastTokensMap }),
      );
    },
    [],
  );

  const context = useMemo<ITokenDataContextTypes>(
    () => ({ tokensMap: accountTokensMap, fiatMap: tokenFiatMap, networkId }),
    [accountTokensMap, tokenFiatMap, networkId],
  );

  useEffect(() => {
    if (!networkUtils.isAllNetwork({ networkId })) {
      return;
    }
    appEventBus.on(EAppEventBusNames.TokenListUpdate, updateTokenList);
    return () => {
      appEventBus.off(EAppEventBusNames.TokenListUpdate, updateTokenList);
    };
  }, [updateTokenList, networkId]);
  return (
    <TokenDataContext.Provider value={context}>
      {children}
    </TokenDataContext.Provider>
  );
}
