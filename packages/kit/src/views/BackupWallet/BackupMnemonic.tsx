import { useCallback } from 'react';

import { useNavigation, useRoute } from '@react-navigation/native';

import type { BackupWalletRoutesParams } from '@onekeyhq/kit/src/routes/Root/Modal/BackupWallet';
import type { BackupWalletModalRoutes } from '@onekeyhq/kit/src/routes/routesEnum';
import { updateWallet } from '@onekeyhq/kit/src/store/reducers/runtime';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useGetWalletDetail } from '../../hooks/redux';
import { Mnemonic } from '../CreateWallet/AppWallet/Mnemonic';

import type { RouteProp } from '@react-navigation/native';

type RouteProps = RouteProp<
  BackupWalletRoutesParams,
  BackupWalletModalRoutes.BackupWalletMnemonicModal
>;

const BackupWalletMnemonic = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { mnemonic, walletId } = route.params;
  const walletDetail = useGetWalletDetail(walletId);
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
