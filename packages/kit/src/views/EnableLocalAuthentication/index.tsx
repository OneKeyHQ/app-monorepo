import React, { FC, useEffect } from 'react';

import { useNavigation } from '@react-navigation/native';

import { Center, Modal, Spinner } from '@onekeyhq/components';

import Protected from '../../components/Protected';
import { useAppDispatch, useSettings } from '../../hooks/redux';
import { setEnableLocalAuthentication } from '../../store/reducers/settings';

type EnableLocalAuthenticationProps = {
  password: string;
};

const EnableLocalAuthenticationDone: FC<
  EnableLocalAuthenticationProps
> = () => {
  const dispatch = useAppDispatch();
  const { enableLocalAuthentication } = useSettings();
  const navigation = useNavigation();
  useEffect(() => {
    function main() {
      dispatch(setEnableLocalAuthentication(!enableLocalAuthentication));
      if (navigation.canGoBack()) {
        navigation.getParent()?.goBack?.();
      }
    }
    main();
  }, [navigation, dispatch, enableLocalAuthentication]);
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
