import { useCallback } from 'react';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useSupportNetworkId } from '@onekeyhq/kit/src/views/FiatCrypto/hooks';
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
  const { result: isSupported } = useSupportNetworkId('buy', networkId);
  const navigation = useAppNavigation();
  const handleOnBuy = useCallback(() => {
    navigation.pushModal(EModalRoutes.FiatCryptoModal, {
      screen: EModalFiatCryptoRoutes.BuyModal,
      params: { networkId, accountId },
    });
  }, [accountId, navigation, networkId]);

  return { handleOnBuy, isSupported };
}

export { useBuyToken };
