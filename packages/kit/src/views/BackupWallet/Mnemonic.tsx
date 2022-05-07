import React, { useCallback } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';

import {
  BackupWalletModalRoutes,
  BackupWalletRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/BackupWallet';

import { Mnemonic } from '../CreateWallet/AppWallet/Mnemonic';

type RouteProps = RouteProp<
  BackupWalletRoutesParams,
  BackupWalletModalRoutes.BackupWalletMnemonicModal
>;

const BackupWalletMnemonic = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { mnemonic } = route.params;
  const onPress = useCallback(() => {
    const inst = navigation.getParent() || navigation;
    inst.goBack();
  }, [navigation]);
  return <Mnemonic onPress={onPress} mnemonic={mnemonic} />;
};

export default BackupWalletMnemonic;
