import { RouteProp, useRoute } from '@react-navigation/native';

import { Box, Modal } from '@onekeyhq/components';

import Protected, { ValidationFields } from '../../../components/Protected';
import { KeyTagRoutes } from '../Routes/enums';
import { IKeytagRoutesParams } from '../Routes/types';

type RouteProps = RouteProp<IKeytagRoutesParams, KeyTagRoutes.VerifyPassword>;

const VerifyPassword = () => {
  const route = useRoute<RouteProps>();
  const { walletId } = route.params;
  return (
    <Modal footer={null}>
      <Protected walletId={walletId} field={ValidationFields.Secret}>
        {(password) => {
          console.log('password--', password);
        }}
      </Protected>
    </Modal>
  );
};

export default VerifyPassword;
