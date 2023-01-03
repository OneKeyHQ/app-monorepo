import { useMemo } from 'react';

import { useNavigation, useRoute } from '@react-navigation/native';

import { Modal } from '@onekeyhq/components';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';

import Protected, { ValidationFields } from '../../../components/Protected';
import LayoutContainer from '../../Onboarding/Layout';
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
  const { walletId, wallet, navigateMode } = route.params;
  const modalContent = useMemo(
    () => (
      <Modal
        footer={null}
        hideBackButton={!!navigateMode}
        headerShown={!navigateMode}
      >
        <Protected walletId={walletId} field={ValidationFields.Secret}>
          {(password) => {
            navigation.replace(KeyTagRoutes.KeyTagAttention, {
              walletId,
              password,
              wallet,
              navigateMode,
            });
          }}
        </Protected>
      </Modal>
    ),
    [navigateMode, navigation, wallet, walletId],
  );
  if (!navigateMode) return modalContent;
  return <LayoutContainer>{modalContent}</LayoutContainer>;
};

export default VerifyPassword;
