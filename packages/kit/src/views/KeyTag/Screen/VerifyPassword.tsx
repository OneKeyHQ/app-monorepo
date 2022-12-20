import { useNavigation, useRoute } from '@react-navigation/native';

import { Modal } from '@onekeyhq/components';
import type { KeyTagVerifyWalletRoutesParams } from '@onekeyhq/kit/src/routes/Modal/KeyTagVerifyWallet';
import { KeyTagVerifyWalletRoutes } from '@onekeyhq/kit/src/routes/Modal/KeyTagVerifyWallet';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';

import Protected, { ValidationFields } from '../../../components/Protected';

import type { RouteProp } from '@react-navigation/native';

type RouteProps = RouteProp<
  KeyTagVerifyWalletRoutesParams,
  KeyTagVerifyWalletRoutes.KeyTagVerifyPassword
>;
type NavigationProps = ModalScreenProps<KeyTagVerifyWalletRoutesParams>;

const VerifyPassword = () => {
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<NavigationProps['navigation']>();
  const { walletId, wallet } = route.params;
  return (
    <Modal footer={null}>
      <Protected walletId={walletId} field={ValidationFields.Secret}>
        {(password) => {
          navigation.replace(KeyTagVerifyWalletRoutes.KeyTagAttensions, {
            walletId,
            password,
            wallet,
          });
        }}
      </Protected>
    </Modal>
  );
};

export default VerifyPassword;
