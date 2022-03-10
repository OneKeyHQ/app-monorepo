import React, { FC, useEffect } from 'react';

import { useNavigation } from '@react-navigation/native';

import { Center, Modal, Spinner } from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import Protected from '../../../components/Protected';

type DoneProps = {
  password: string;
};

const Done: FC<DoneProps> = ({ password }) => {
  const { serviceApp } = backgroundApiProxy;
  const navigation = useNavigation();
  useEffect(() => {
    async function main() {
      await serviceApp.createHDWallet({ password });
      if (navigation.canGoBack()) {
        navigation.getParent()?.goBack?.();
      }
    }
    main();
  }, [navigation, password, serviceApp]);
  return (
    <Center h="full" w="full">
      <Spinner size="lg" />
    </Center>
  );
};

export const AppWalletDone = () => (
  <Modal footer={null}>
    <Protected>{(password) => <Done password={password} />}</Protected>
  </Modal>
);

export default AppWalletDone;
