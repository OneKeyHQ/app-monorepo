/* eslint-disable react-hooks/exhaustive-deps */
import React, { FC, useEffect } from 'react';

import { RouteProp, useRoute } from '@react-navigation/native';

import { Center, Modal, Spinner } from '@onekeyhq/components';
import Protected, {
  ValidationFields,
} from '@onekeyhq/kit/src/components/Protected';
import {
  CreateAccountModalRoutes,
  CreateAccountRoutesParams,
} from '@onekeyhq/kit/src/routes';

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

export const HDAccountAuthentication: FC = () => {
  const route = useRoute<RouteProps>();
  const { onDone } = route.params;
  return (
    <Modal footer={null}>
      <Protected field={ValidationFields.Account}>
        {(password) => (
          <HDAccountAuthenticationDone
            password={password}
            onDone={() => {
              onDone(password);
            }}
          />
        )}
      </Protected>
    </Modal>
  );
};

export default HDAccountAuthentication;
