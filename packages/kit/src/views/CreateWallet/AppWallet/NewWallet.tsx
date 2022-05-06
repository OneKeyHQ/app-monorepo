import React, { FC, useEffect } from 'react';

import {
  useNavigation,
  NavigationProp,
} from '@react-navigation/native';

import { Center, Modal, Spinner } from '@onekeyhq/components';
import Protected, {
  ValidationFields,
} from '@onekeyhq/kit/src/components/Protected';
import {
  CreateWalletModalRoutes,
  CreateWalletRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/CreateWallet';

type NavigationProps = NavigationProp<
  CreateWalletRoutesParams,
  CreateWalletModalRoutes.NewWalletModal
>;

type NewWalletProps = {
  password: string;
  withEnableAuthentication?: boolean;
};

const NewWallet: FC<NewWalletProps> = ({
  password,
  withEnableAuthentication,
}) => {
  const navigation = useNavigation<NavigationProps>();
  useEffect(() => {
    navigation.navigate(CreateWalletModalRoutes.AttentionsModal, {
      password,
      withEnableAuthentication,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Center h="full" w="full">
      <Spinner size="lg" />
    </Center>
  );
};

export const NewWalletModal = () => {
  return (
    <Modal footer={null}>
      <Protected skipSavePassword field={ValidationFields.Wallet}>
        {(password, { withEnableAuthentication }) => (
          <NewWallet
            password={password}
            withEnableAuthentication={withEnableAuthentication}
          />
        )}
      </Protected>
    </Modal>
  );
};

export default NewWalletModal;
