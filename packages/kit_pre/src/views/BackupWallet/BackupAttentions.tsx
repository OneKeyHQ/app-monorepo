import { useCallback } from 'react';

import { useNavigation, useRoute } from '@react-navigation/native';

import type { BackupWalletRoutesParams } from '@onekeyhq/kit/src/routes/Root/Modal/BackupWallet';
import { BackupWalletModalRoutes } from '@onekeyhq/kit/src/routes/routesEnum';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { Attentions } from '../CreateWallet/AppWallet/Attentions';

import type { RouteProp } from '@react-navigation/native';

type RouteProps = RouteProp<
  BackupWalletRoutesParams,
  BackupWalletModalRoutes.BackupWalletAttentionsModal
>;

type NavigationProps = ModalScreenProps<BackupWalletRoutesParams>;

const BackupWalletAttentions = () => {
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<NavigationProps['navigation']>();
  const { walletId, password } = route.params;
  const onPress = useCallback(async () => {
    const mnemonic = await backgroundApiProxy.engine.revealHDWalletMnemonic(
      walletId,
      password,
    );
    navigation.navigate(BackupWalletModalRoutes.BackupWalletMnemonicModal, {
      mnemonic,
      walletId,
    });
  }, [navigation, walletId, password]);
  return <Attentions onPress={onPress} />;
};

export default BackupWalletAttentions;
