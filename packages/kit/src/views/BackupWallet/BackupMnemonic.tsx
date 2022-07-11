import React, { useCallback } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';

import {
  BackupWalletModalRoutes,
  BackupWalletRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/BackupWallet';
import { updateWallet } from '@onekeyhq/kit/src/store/reducers/runtime';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useWallet } from '../../hooks/redux';
import { Mnemonic } from '../CreateWallet/AppWallet/Mnemonic';

type RouteProps = RouteProp<
  BackupWalletRoutesParams,
  BackupWalletModalRoutes.BackupWalletMnemonicModal
>;

const BackupWalletMnemonic = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { mnemonic, walletId } = route.params;
  const walletDetail = useWallet(walletId);
  const onPress = useCallback(async () => {
    if (walletDetail && !walletDetail.backuped) {
      const wallet = await backgroundApiProxy.engine.confirmHDWalletBackuped(
        walletId,
      );
      backgroundApiProxy.dispatch(updateWallet(wallet));
    }
    const inst = navigation.getParent() || navigation;
    inst.goBack();
  }, [navigation, walletDetail, walletId]);
  return <Mnemonic onPromise={onPress} mnemonic={mnemonic} />;
};

export default BackupWalletMnemonic;
