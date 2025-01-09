import { useCallback } from 'react';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  useAllTokenListAtom,
  useAllTokenListMapAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/tokenList';
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
) =>
  usePromiseResult(
    async () =>
      backgroundApiProxy.serviceFiatCrypto.isTokenSupported({
        networkId,
        tokenAddress,
        type,
      }),
    [networkId, tokenAddress, type],
    { initResult: false, debounced: 100 },
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
  const [allTokens] = useAllTokenListAtom();
  const [map] = useAllTokenListMapAtom();
  const navigation = useAppNavigation();
  const handleFiatCrypto = useCallback(() => {
    navigation.pushModal(EModalRoutes.FiatCryptoModal, {
      screen:
        fiatCryptoType === 'buy'
          ? EModalFiatCryptoRoutes.BuyModal
          : EModalFiatCryptoRoutes.SellModal,
      params: { networkId, accountId, tokens: allTokens.tokens, map },
    });
  }, [accountId, navigation, networkId, allTokens, map, fiatCryptoType]);

  return {
    handleFiatCrypto,
    isSupported: Boolean(networkId && accountId && isSupported),
  };
}
