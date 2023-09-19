import type { FC } from 'react';
import { useEffect } from 'react';

import { useNavigation, useRoute } from '@react-navigation/native';

import { Center, Modal, Spinner } from '@onekeyhq/components';
import type { BackupWalletRoutesParams } from '@onekeyhq/kit/src/routes/Root/Modal/BackupWallet';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import Protected, { ValidationFields } from '../../components/Protected';
import {
  CreateWalletModalRoutes,
  ModalRoutes,
  RootRoutes,
} from '../../routes/routesEnum';

import type { BackupWalletModalRoutes } from '../../routes/routesEnum';
import type { RouteProp } from '@react-navigation/native';

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
    backgroundApiProxy.engine
      .revealHDWalletMnemonic(walletId, password)
      .then((mnemonic) => {
        setTimeout(() => {
          navigation.replace(RootRoutes.Modal, {
            screen: ModalRoutes.CreateWallet,
            params: {
              screen:
                CreateWalletModalRoutes.OnekeyLiteBackupPinCodeVerifyModal,
              params: {
                walletId,
                backupData: mnemonic,
                onSuccess: () => {},
              },
            },
          });
        }, 500);
      });
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
