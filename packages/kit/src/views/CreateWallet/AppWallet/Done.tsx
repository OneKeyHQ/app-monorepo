import React, { FC, useEffect } from 'react';

import { useNavigation } from '@react-navigation/native';

import { Center, Modal, Spinner } from '@onekeyhq/components';

import Protected from '../../../components/Protected';
import engine from '../../../engine/EngineProvider';
import { useAppDispatch } from '../../../hooks/redux';
import {
  setBoardingCompleted,
  setPasswordCompleted,
  unlock,
} from '../../../store/reducers/status';

type DoneProps = {
  password: string;
};

const Done: FC<DoneProps> = ({ password }) => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation();
  useEffect(() => {
    async function main() {
      await engine.createHDWallet(password);
      dispatch(setBoardingCompleted());
      dispatch(setPasswordCompleted());
      dispatch(unlock());
      if (navigation.canGoBack()) {
        navigation.getParent()?.goBack?.();
      }
    }
    main();
  }, [navigation, dispatch, password]);
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
