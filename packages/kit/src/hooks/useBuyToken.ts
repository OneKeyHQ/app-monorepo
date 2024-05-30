import { useCallback } from 'react';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useSupportNetworkId } from '@onekeyhq/kit/src/views/FiatCrypto/hooks';
import {
  EModalFiatCryptoRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';

function useBuyToken() {
  const {
    activeAccount: { account, network },
  } = useActiveAccount({ num: 0 });
  const { result: isSupported } = useSupportNetworkId({
    networkId: network?.id ?? '',
    type: 'buy',
  });
  const navigation = useAppNavigation();
  const handleOnBuy = useCallback(() => {
    if (!account || !network) return;
    navigation.pushModal(EModalRoutes.FiatCryptoModal, {
      screen: EModalFiatCryptoRoutes.BuyModal,
      params: { networkId: network.id, accountId: account.id },
    });
  }, [account, navigation, network]);

  return { handleOnBuy, isSupported };
}

export { useBuyToken };
