import { useCallback } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';

import {
  BackupWalletModalRoutes,
  BackupWalletRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/BackupWallet';
import { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { Attentions } from '../CreateWallet/AppWallet/Attentions';

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
