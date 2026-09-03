import { useCallback } from 'react';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useHomeTokenListSnapshot } from '@onekeyhq/kit/src/states/jotai/contexts/tokenList/cells';
import {
  EModalFiatCryptoRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { swrKeys } from '@onekeyhq/shared/src/utils/swrCacheUtils';
import type {
  IFiatCryptoTokenListWithNetworks,
  IFiatCryptoType,
  IGetTokensListParams,
} from '@onekeyhq/shared/types/fiatCrypto';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';

export const useSupportNetworkId = (
  type: IFiatCryptoType,
  networkId: string | undefined,
) =>
  usePromiseResult(
    async () => {
      if (!networkId) return false;
      if (networkUtils.isAllNetwork({ networkId })) return true;
      return backgroundApiProxy.serviceFiatCrypto.isNetworkSupported({
        networkId,
        type,
      });
    },
    [networkId, type],
    {
      initResult: false,
      debounced: 100,
    },
  );

export const useSupportToken = (
  networkId: string,
  tokenAddress: string,
  type: IFiatCryptoType,
  isFocused = true,
) =>
  usePromiseResult(
    async () =>
      backgroundApiProxy.serviceFiatCrypto.isTokenSupported({
        networkId,
        tokenAddress,
        type,
      }),
    [networkId, tokenAddress, type],
    {
      initResult: false,
      debounced: 100,
      overrideIsFocused: (isPageFocused) => isPageFocused && isFocused,
    },
  );

const EMPTY_TOKEN_LIST_WITH_NETWORKS: IFiatCryptoTokenListWithNetworks = {
  tokens: [],
  networksMap: {},
  mergeDeriveAssetsNetworkIds: [],
};

// The snapshot is only safe when the rows the bg returns are exactly the rows
// the list paints:
// - the sell list is filtered by live balances, so a stale snapshot could
//   briefly show a token the user no longer holds;
// - on All Networks, SellOrBuyContent drops networks incompatible with an
//   imported / watching / external account only after the async account read
//   lands, so a snapshot would paint those rows first and then remove them.
function shouldSnapshotTokensList({
  networkId,
  type,
  accountId,
}: IGetTokensListParams): boolean {
  if (type !== 'buy') {
    return false;
  }
  return !(
    networkUtils.isAllNetwork({ networkId }) &&
    accountUtils.isOthersAccount({ accountId })
  );
}

// Tokens and their network metadata come back in one background response so
// the list renders names, badges and logos in a single commit.
export const useGetTokensListWithNetworks = ({
  networkId,
  type,
  accountId,
}: IGetTokensListParams) =>
  usePromiseResult(
    async () =>
      backgroundApiProxy.serviceFiatCrypto.getTokensListWithNetworks({
        networkId,
        type,
        accountId,
      }),
    [networkId, type, accountId],
    {
      initResult: EMPTY_TOKEN_LIST_WITH_NETWORKS,
      watchLoading: true,
      swrKey: shouldSnapshotTokensList({ networkId, type, accountId })
        ? swrKeys.fiatCryptoTokenList({ networkId, type, accountId })
        : undefined,
    },
  );

export function useFiatCrypto({
  accountId,
  networkId,
  fiatCryptoType,
}: {
  accountId: string;
  networkId: string;
  fiatCryptoType: IFiatCryptoType;
}) {
  const { result: isSupported } = useSupportNetworkId(
    fiatCryptoType,
    networkId,
  );

  // Callback snapshot of the home raw list + full fiat map (red-team R-#4):
  // captured in the `handleFiatCrypto` closure, refreshed on each home structure
  // frame. Replaces the deleted `allTokenListAtom` / `allTokenListMapAtom`.
  const { tokens: allTokens, map } = useHomeTokenListSnapshot();
  const navigation = useAppNavigation();
  const handleFiatCrypto = useCallback(
    (params: { sameModal?: boolean } | undefined) => {
      const { sameModal } = params ?? {};
      const routeParams = {
        networkId,
        accountId,
        tokens: allTokens,
        map,
        defaultTab: fiatCryptoType,
      };
      if (sameModal) {
        navigation.push(EModalFiatCryptoRoutes.BuyModal, routeParams);
      } else {
        navigation.pushModal(EModalRoutes.FiatCryptoModal, {
          screen: EModalFiatCryptoRoutes.BuyModal,
          params: routeParams,
        });
      }
    },
    [accountId, navigation, networkId, allTokens, map, fiatCryptoType],
  );

  return {
    handleFiatCrypto,
    isSupported: Boolean(networkId && accountId && isSupported),
  };
}
