import { useNavigation, useRoute } from '@react-navigation/native';

import { Modal } from '@onekeyhq/components';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';

import Protected, { ValidationFields } from '../../../components/Protected';
import { KeyTagRoutes } from '../Routes/enums';

import type { IKeytagRoutesParams } from '../Routes/types';
import type { RouteProp } from '@react-navigation/native';

type RouteProps = RouteProp<
  IKeytagRoutesParams,
  KeyTagRoutes.KeyTagVerifyPassword
>;
type NavigationProps = ModalScreenProps<IKeytagRoutesParams>;

const VerifyPassword = () => {
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<NavigationProps['navigation']>();
  const { walletId, wallet } = route.params;
  return (
    <Modal footer={null}>
      <Protected walletId={walletId} field={ValidationFields.Secret}>
        {(password) => {
          navigation.replace(KeyTagRoutes.KeyTagAttention, {
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
