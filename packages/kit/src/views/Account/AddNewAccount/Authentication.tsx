/* eslint-disable react-hooks/exhaustive-deps */
import type { FC } from 'react';
import { useEffect } from 'react';

import { useRoute } from '@react-navigation/native';

import { Center, Modal, Spinner } from '@onekeyhq/components';
import Protected, {
  ValidationFields,
} from '@onekeyhq/kit/src/components/Protected';
import type { CreateAccountRoutesParams } from '@onekeyhq/kit/src/routes';

import { useNavigation } from '../../../hooks';

import type { CreateAccountModalRoutes } from '../../../routes/routesEnum';
import type { RouteProp } from '@react-navigation/native';

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
  const navigation = useNavigation();
  const { onDone, walletId } = route.params;
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: false });
  }, []);
  return (
    <Modal footer={null}>
      <Protected walletId={walletId} field={ValidationFields.Account}>
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
