import React, { FC, useEffect } from 'react';

import { useNavigation } from '@react-navigation/native';

import { Center, Modal, Spinner } from '@onekeyhq/components';
import { updateWallets } from '@onekeyhq/kit/src/store/reducers/wallet';

import Protected from '../../../components/Protected';
import engine from '../../../engine/EngineProvider';
import { useAppDispatch } from '../../../hooks/redux';
import {
  changeActiveAccount,
  runtimeUnlock,
} from '../../../store/reducers/general';
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
      const wallet = await engine.createHDWallet(password);
      const walletsFromBE = await engine.getWallets();
      dispatch(updateWallets(walletsFromBE));
      dispatch(setBoardingCompleted());
      dispatch(setPasswordCompleted());
      dispatch(unlock());
      dispatch(runtimeUnlock());
      dispatch(
        changeActiveAccount({
          account: null,
          wallet,
        }),
      );
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
