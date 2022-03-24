/* eslint-disable react-hooks/exhaustive-deps */
import React, { FC, useEffect } from 'react';

import { useNavigation } from '@react-navigation/core';
import { RouteProp, useRoute } from '@react-navigation/native';

import { Center, Modal, Spinner } from '@onekeyhq/components';
import Protected from '@onekeyhq/kit/src/components/Protected';
import {
  CreateAccountModalRoutes,
  CreateAccountRoutesParams,
} from '@onekeyhq/kit/src/routes';
import { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';

export type EnableLocalAuthenticationProps = {
  password: string;
  onDone?: (password: string) => void;
};

type RouteProps = RouteProp<
  CreateAccountRoutesParams,
  CreateAccountModalRoutes.CreateAccountAuthentication
>;

const HDAccountAuthenticationDone: FC<EnableLocalAuthenticationProps> = ({
  password,
  onDone,
}) => {
  useEffect(() => {
    if (onDone) {
      onDone(password);
    }
  }, []);
  return (
    <Center h="full" w="full">
      <Spinner size="lg" />
    </Center>
  );
};
type NavigationProps = ModalScreenProps<CreateAccountRoutesParams>;

export const HDAccountAuthentication: FC = () => {
  const route = useRoute<RouteProps>();
  const { onDone } = route.params;
  const navigation = useNavigation<NavigationProps['navigation']>();
  return (
    <Modal footer={null}>
      <Protected>
        {(password) => (
          <HDAccountAuthenticationDone
            password={password}
            onDone={() => {
              onDone(password);
              navigation?.goBack();
            }}
          />
        )}
      </Protected>
    </Modal>
  );
};

export default HDAccountAuthentication;
