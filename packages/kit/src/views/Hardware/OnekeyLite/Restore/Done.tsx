import React, { FC, useEffect, useState } from 'react';

import { RouteProp, useNavigation } from '@react-navigation/core';
import { useRoute } from '@react-navigation/native';
import { Center } from 'native-base';

import { Modal, Spinner } from '@onekeyhq/components';
import Protected from '@onekeyhq/kit/src/components/Protected';
import {
  CreateWalletModalRoutes,
  CreateWalletRoutesParams,
} from '@onekeyhq/kit/src/routes';

type RouteProps = RouteProp<
  CreateWalletRoutesParams,
  CreateWalletModalRoutes.OnekeyLiteRestoreDoneModal
>;

const OnekeyLiteRestoreDoneView: FC = () => {
  const navigation = useNavigation();
  const { onSuccess, onCancel } = useRoute<RouteProps>().params;
  const [inputPwd, setInputPwd] = useState('');

  type PasswordViewProps = {
    password: string;
  };
  const PasswordView: FC<PasswordViewProps> = ({ password }) => {
    useEffect(() => {
      if (!password) return;
      if (inputPwd) return;

      setInputPwd(password);
      navigation.goBack();
      onSuccess(password);
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
      <Protected>
        {(password) => <PasswordView password={password} />}
      </Protected>
    </Modal>
  );
};

export default OnekeyLiteRestoreDoneView;
