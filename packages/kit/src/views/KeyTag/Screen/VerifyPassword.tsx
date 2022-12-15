import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';

import { Modal } from '@onekeyhq/components';
import {
  KeyTagVerifyWalletRoutes,
  KeyTagVerifyWalletRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/KeyTagVerifyWallet';
import { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';

import Protected, { ValidationFields } from '../../../components/Protected';

type RouteProps = RouteProp<
  KeyTagVerifyWalletRoutesParams,
  KeyTagVerifyWalletRoutes.KeyTagVerifyPassword
>;
type NavigationProps = ModalScreenProps<KeyTagVerifyWalletRoutesParams>;

const VerifyPassword = () => {
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<NavigationProps['navigation']>();
  const { walletId } = route.params;
  console.log('VerifyPassword--', walletId);
  return (
    <Modal footer={null}>
      <Protected walletId={walletId} field={ValidationFields.Secret}>
        {(password) => {
          console.log('password--', password);
          // navigation.navigate(KeyTagRoutes.Attentions, { walletId, password });
          navigation.replace(KeyTagVerifyWalletRoutes.KeyTagAttensions, {
            walletId,
            password,
          });
        }}
      </Protected>
    </Modal>
  );
};

export default VerifyPassword;
