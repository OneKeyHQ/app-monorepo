import type { PropsWithChildren } from 'react';
import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';

export type ITokenDataContext = {
  tokens: IAccountToken[];
  map: Record<string, ITokenFiat>;
};

export const TokenDataContext = createContext<ITokenDataContext>({
  tokens: [],
  map: {},
});

export function TokenDataContainer({
  children,
  initialMap,
  initialTokens,
}: PropsWithChildren<{
  initialTokens: IAccountToken[];
  initialMap: Record<string, ITokenFiat>;
}>) {
  const [accountTokens, setAccountTokens] =
    useState<IAccountToken[]>(initialTokens);
  const [tokenFiatMap, setTokenFiatMap] =
    useState<Record<string, ITokenFiat>>(initialMap);
  const updateTokenList = useCallback(({ tokens, map }: ITokenDataContext) => {
    setAccountTokens(tokens);
    setTokenFiatMap(map);
  }, []);

  const context = useMemo<ITokenDataContext>(
    () => ({ tokens: accountTokens, map: tokenFiatMap }),
    [accountTokens, tokenFiatMap],
  );
  useEffect(() => {
    appEventBus.on(EAppEventBusNames.TokenListUpdate, updateTokenList);
    return () => {
      appEventBus.off(EAppEventBusNames.TokenListUpdate, updateTokenList);
    };
  }, [updateTokenList]);
  return (
    <TokenDataContext.Provider value={context}>
      {children}
    </TokenDataContext.Provider>
  );
}
