import React, { FC, useEffect } from 'react';

import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Center, Modal, Spinner } from '@onekeyhq/components';

import Protected from '../../components/Protected';
import { useAppDispatch, useSettings } from '../../hooks/redux';
import { useLocalAuthentication } from '../../hooks/useLocalAuthentication';
import { useToast } from '../../hooks/useToast';
import { toggleEnableLocalAuthentication } from '../../store/reducers/settings';

type EnableLocalAuthenticationProps = {
  isLocalAuthentication?: boolean;
};

const EnableLocalAuthenticationDone: FC<EnableLocalAuthenticationProps> = ({
  isLocalAuthentication,
}) => {
  const dispatch = useAppDispatch();
  const intl = useIntl();
  const { enableLocalAuthentication } = useSettings();
  const { info } = useToast();
  const { localAuthenticate } = useLocalAuthentication();
  const navigation = useNavigation();
  useEffect(() => {
    async function main() {
      if (!enableLocalAuthentication && !isLocalAuthentication) {
        const result = await localAuthenticate();
        if (!result.success) {
          info(intl.formatMessage({ id: 'msg__verification_failure' }));
          navigation?.goBack?.();
          return;
        }
      }
      dispatch(toggleEnableLocalAuthentication());
      navigation?.goBack?.();
    }
    main();
    // eslint-disable-next-line
  }, []);
  return (
    <Center h="full" w="full">
      <Spinner size="lg" />
    </Center>
  );
};

export const EnableLocalAuthentication = () => (
  <Modal footer={null}>
    <Protected>
      {(_, isLocalAuthentication) => (
        <EnableLocalAuthenticationDone
          isLocalAuthentication={isLocalAuthentication}
        />
      )}
    </Protected>
  </Modal>
);

export default EnableLocalAuthentication;
