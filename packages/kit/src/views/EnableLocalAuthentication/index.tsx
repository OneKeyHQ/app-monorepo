import React, { FC, useEffect } from 'react';

import { useNavigation } from '@react-navigation/native';

import { Center, Modal, Spinner } from '@onekeyhq/components';

import Protected from '../../components/Protected';
import { useAppDispatch } from '../../hooks/redux';
import { toggleEnableLocalAuthentication } from '../../store/reducers/settings';

type EnableLocalAuthenticationProps = {
  password: string;
};

const EnableLocalAuthenticationDone: FC<
  EnableLocalAuthenticationProps
> = () => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation();
  useEffect(() => {
    function main() {
      dispatch(toggleEnableLocalAuthentication());
      if (navigation.canGoBack()) {
        navigation.getParent()?.goBack?.();
      }
    }
    main();
  }, [navigation, dispatch]);
  return (
    <Center h="full" w="full">
      <Spinner size="lg" />
    </Center>
  );
};

export const EnableLocalAuthentication = () => (
  <Modal footer={null}>
    <Protected>
      {(password) => <EnableLocalAuthenticationDone password={password} />}
    </Protected>
  </Modal>
);

export default EnableLocalAuthentication;
