import type { FC } from 'react';
import { useEffect, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useRoute } from '@react-navigation/native';
import { Center } from 'native-base';

import { Modal, OverlayContainer, Spinner } from '@onekeyhq/components';
import Protected from '@onekeyhq/kit/src/components/Protected';
import type { ManagerWalletRoutesParams } from '@onekeyhq/kit/src/routes/Root/Modal/ManagerWallet';

import type { ManagerWalletModalRoutes } from '../../../routes/routesEnum';
import type { RouteProp } from '@react-navigation/core';

type RouteProps = RouteProp<
  ManagerWalletRoutesParams,
  ManagerWalletModalRoutes.ManagerWalletAuthorityVerifyModal
>;

const ManagerWalletLocalValidationView: FC = () => {
  const navigation = useNavigation();
  const { requestId, onSuccess, onCancel, field } =
    useRoute<RouteProps>().params;
  const [inputPwd, setInputPwd] = useState('');
  type PasswordViewProps = {
    password: string;
  };
  // eslint-disable-next-line
  const PasswordView: FC<PasswordViewProps> = ({ password }) => {
    useEffect(() => {
      if (!password) return;
      if (inputPwd) return;

      setInputPwd(password);
      setTimeout(() => {
        onSuccess(password, requestId);
        navigation.goBack();
      }, 500);
    }, [password]);

    return (
      <Center w="full" h="full">
        <Spinner size="lg" />
      </Center>
    );
  };

  return (
    <OverlayContainer
      style={{
        // higher than every known layer
        zIndex: 10000,
      }}
    >
      <Modal
        footer={null}
        onModalClose={() => {
          if (!inputPwd) onCancel?.();
        }}
      >
        <Protected walletId={null} field={field}>
          {(password) => <PasswordView password={password} />}
        </Protected>
      </Modal>
    </OverlayContainer>
  );
};

export default ManagerWalletLocalValidationView;
