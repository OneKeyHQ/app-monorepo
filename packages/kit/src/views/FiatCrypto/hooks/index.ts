import { useCallback } from 'react';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useHomeTokenListSnapshot } from '@onekeyhq/kit/src/states/jotai/contexts/tokenList/cells';
import {
  EModalFiatCryptoRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type {
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

export const useGetTokensList = ({
  networkId,
  type,
  accountId,
}: IGetTokensListParams) =>
  usePromiseResult(
    async () => {
      const data = await backgroundApiProxy.serviceFiatCrypto.getTokensList({
        networkId,
        type,
        accountId,
      });
      return data;
    },
    [networkId, type, accountId],
    { initResult: [], watchLoading: true },
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
