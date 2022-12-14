import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { Box, Modal } from '@onekeyhq/components';

import Protected, { ValidationFields } from '../../../components/Protected';
import { KeyTagRoutes } from '../Routes/enums';
import { IKeytagRoutesParams } from '../Routes/types';

type RouteProps = RouteProp<IKeytagRoutesParams, KeyTagRoutes.Attentions>;
type NavigationProps = StackNavigationProp<IKeytagRoutesParams>;

const VerifyPassword = () => {
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<NavigationProps>();
  const { walletId } = route.params;
  console.log('VerifyPassword--', walletId);
  return (
    <Modal footer={null}>
      <Protected walletId={walletId} field={ValidationFields.Secret}>
        {(password) => {
          console.log('password--', password);
          navigation.navigate(KeyTagRoutes.Attentions, { walletId, password });
        }}
      </Protected>
    </Modal>
  );
};

export default VerifyPassword;
