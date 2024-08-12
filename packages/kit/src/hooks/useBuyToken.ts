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

function useBuyToken({
  accountId,
  networkId,
}: {
  accountId: string;
  networkId: string;
}) {
  const [allTokens] = useAllTokenListAtom();
  const [map] = useAllTokenListMapAtom();
  const navigation = useAppNavigation();
  const handleOnBuy = useCallback(() => {
    navigation.pushModal(EModalRoutes.FiatCryptoModal, {
      screen: EModalFiatCryptoRoutes.BuyModal,
      params: { networkId, accountId, tokens: allTokens.tokens, map },
    });
  }, [accountId, navigation, networkId, allTokens, map]);

  return {
    handleOnBuy,
    isSupported: Boolean(networkId && accountId),
  };
}

export { useBuyToken };
