import type { FC } from 'react';
import { useEffect } from 'react';

import { useNavigation, useRoute } from '@react-navigation/native';

import { Modal } from '@onekeyhq/components';
import type { BackupWalletRoutesParams } from '@onekeyhq/kit/src/routes/Root/Modal/BackupWallet';
import { BackupWalletModalRoutes } from '@onekeyhq/kit/src/routes/routesEnum';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';

import Protected, { ValidationFields } from '../../components/Protected';

import type { RouteProp } from '@react-navigation/native';

type NavigationProps = ModalScreenProps<BackupWalletRoutesParams>;

type RouteProps = RouteProp<
  BackupWalletRoutesParams,
  BackupWalletModalRoutes.BackupWalletManualModal
>;

type BackupDoneProps = {
  password: string;
  walletId: string;
};
const BackupDone: FC<BackupDoneProps> = ({ password, walletId }) => {
  const navigation = useNavigation<NavigationProps['navigation']>();
  useEffect(() => {
    navigation.replace(BackupWalletModalRoutes.BackupWalletAttentionsModal, {
      walletId,
      password,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
};

const BackupManual = () => {
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

export default BackupManual;
