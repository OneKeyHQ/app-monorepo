import type { PropsWithChildren } from 'react';
import { createContext, useCallback, useContext, useMemo } from 'react';

import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';

type ITokenListMetaContextValue = {
  networksMap: Record<string, IServerNetwork>;
  mergeDeriveAssetsNetworkIds: ReadonlySet<string>;
  account: INetworkAccount | undefined;
};

const EMPTY_NETWORK_IDS: ReadonlySet<string> = new Set<string>();

const TokenListMetaContext = createContext<ITokenListMetaContextValue>({
  networksMap: {},
  mergeDeriveAssetsNetworkIds: EMPTY_NETWORK_IDS,
  account: undefined,
});

export const useGetNetwork = ({
  networkId,
}: {
  networkId: string;
}): IServerNetwork | undefined => {
  const { networksMap } = useContext(TokenListMetaContext);
  return networksMap[networkId];
};

export const useTokenListMeta = () => {
  const { account, mergeDeriveAssetsNetworkIds } =
    useContext(TokenListMetaContext);
  const isMergeDeriveAssetsNetwork = useCallback(
    (networkId: string) => mergeDeriveAssetsNetworkIds.has(networkId),
    [mergeDeriveAssetsNetworkIds],
  );
  return { account, isMergeDeriveAssetsNetwork };
};

// Synchronous provider for per-row metadata. Everything here arrives in the
// same background response as the token list (see
// `serviceFiatCrypto.getTokensListWithNetworks`), so rows never paint a
// partial state that a later async result has to patch — which is what caused
// the staged badge / icon pop-in on Android (OK-61597).
export function TokenListMetaContainer({
  networksMap,
  mergeDeriveAssetsNetworkIds,
  account,
  children,
}: PropsWithChildren<{
  networksMap: Record<string, IServerNetwork>;
  mergeDeriveAssetsNetworkIds: string[];
  account: INetworkAccount | undefined;
}>) {
  const value = useMemo<ITokenListMetaContextValue>(
    () => ({
      networksMap,
      mergeDeriveAssetsNetworkIds: new Set(mergeDeriveAssetsNetworkIds),
      account,
    }),
    [networksMap, mergeDeriveAssetsNetworkIds, account],
  );
  return (
    <TokenListMetaContext.Provider value={value}>
      {children}
    </TokenListMetaContext.Provider>
  );
}
