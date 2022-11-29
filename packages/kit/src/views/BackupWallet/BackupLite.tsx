import React, { FC, useEffect } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';

import { Center, Modal, Spinner } from '@onekeyhq/components';
import {
  BackupWalletModalRoutes,
  BackupWalletRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/BackupWallet';
import { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import Protected, { ValidationFields } from '../../components/Protected';
import { CreateWalletModalRoutes } from '../../routes';
import { ModalRoutes, RootRoutes } from '../../routes/types';

type NavigationProps = ModalScreenProps<BackupWalletRoutesParams>;

type RouteProps = RouteProp<
  BackupWalletRoutesParams,
  BackupWalletModalRoutes.BackupWalletLiteModal
>;

type BackupDoneProps = {
  password: string;
  walletId: string;
};
const BackupDone: FC<BackupDoneProps> = ({ password, walletId }) => {
  const navigation = useNavigation<NavigationProps['navigation']>();
  useEffect(() => {
    async function main() {
      const mnemonic = await backgroundApiProxy.engine.revealHDWalletMnemonic(
        walletId,
        password,
      );
      setTimeout(() => {
        navigation.replace(RootRoutes.Modal, {
          screen: ModalRoutes.CreateWallet,
          params: {
            screen: CreateWalletModalRoutes.OnekeyLiteBackupPinCodeVerifyModal,
            params: {
              walletId,
              backupData: mnemonic,
              onSuccess: () => {},
            },
          },
        });
      }, 500);
    }
    main();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Center>
      <Spinner />
    </Center>
  );
};

const BackupLite = () => {
  const route = useRoute<RouteProps>();
  const { walletId } = route.params;
  return (
    <Modal footer={null}>
      <Protected walletId={walletId} field={ValidationFields.Secret}>
        {(password) => <BackupDone password={password} walletId={walletId} />}
      </Protected>
    </Modal>
  );
};

export default BackupLite;
