import { FC, useEffect, useState } from 'react';

import { RouteProp, useNavigation } from '@react-navigation/core';
import { useRoute } from '@react-navigation/native';
import { Center } from 'native-base';

import { Modal, Spinner } from '@onekeyhq/components';
import Protected from '@onekeyhq/kit/src/components/Protected';
import {
  ManagerWalletModalRoutes,
  ManagerWalletRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/ManagerWallet';

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
    <Modal
      footer={null}
      onClose={() => {
        if (!inputPwd) onCancel?.();
      }}
    >
      <Protected walletId={null} field={field}>
        {(password) => <PasswordView password={password} />}
      </Protected>
    </Modal>
  );
};

export default ManagerWalletLocalValidationView;
