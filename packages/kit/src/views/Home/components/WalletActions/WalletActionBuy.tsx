import { useCallback } from 'react';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useSupportNetworkId } from '@onekeyhq/kit/src/views/FiatCrypto/hooks';
import {
  EModalFiatCryptoRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';

import { RawActions } from './RawActions';

export function WalletActionBuy({
  networkId,
  accountId,
}: {
  networkId: string;
  accountId: string;
}) {
  const { result: isSupported } = useSupportNetworkId({
    networkId,
    type: 'buy',
  });
  const navigation = useAppNavigation();
  const onPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.FiatCryptoModal, {
      screen: EModalFiatCryptoRoutes.BuyModal,
      params: { networkId, accountId },
    });
  }, [navigation, networkId, accountId]);
  return <RawActions.Buy onPress={onPress} disabled={!isSupported} />;
}
