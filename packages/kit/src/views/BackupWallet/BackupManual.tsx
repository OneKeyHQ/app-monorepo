import { FC, useEffect } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';

import { Modal } from '@onekeyhq/components';
import {
  BackupWalletModalRoutes,
  BackupWalletRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/BackupWallet';
import { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';

import Protected, { ValidationFields } from '../../components/Protected';

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
  return <></>;
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
