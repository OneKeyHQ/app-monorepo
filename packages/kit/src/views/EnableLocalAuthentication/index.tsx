import React, { FC, useEffect } from 'react';

import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Center, Modal, Spinner, useToast } from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import Protected from '../../components/Protected';
import { useSettings } from '../../hooks/redux';
import { useLocalAuthentication } from '../../hooks/useLocalAuthentication';
import { toggleEnableLocalAuthentication } from '../../store/reducers/settings';

type EnableLocalAuthenticationProps = {
  password: string;
  isLocalAuthentication?: boolean;
};

const EnableLocalAuthenticationDone: FC<EnableLocalAuthenticationProps> = ({
  password,
  isLocalAuthentication,
}) => {
  const { dispatch } = backgroundApiProxy;
  const intl = useIntl();
  const { enableLocalAuthentication } = useSettings();
  const toast = useToast();
  const { localAuthenticate, savePassword } = useLocalAuthentication();

  const navigation = useNavigation();
  useEffect(() => {
    async function main() {
      if (!enableLocalAuthentication && !isLocalAuthentication) {
        const result = await localAuthenticate();
        if (!result.success) {
          toast.show(
            {
              title: intl.formatMessage({ id: 'msg__verification_failure' }),
            },
            {
              type: 'error',
            },
          );
          setTimeout(() => {
            // delay 1000ms goBack, otherwise the keyboard will be showup
            navigation?.goBack?.();
          }, 1000);
          return;
        }
      }
      savePassword(enableLocalAuthentication ? '' : password);
      dispatch(toggleEnableLocalAuthentication());
      setTimeout(() => {
        // delay 1000ms goBack, otherwise the keyboard will be showup
        navigation?.goBack?.();
      }, 1000);
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
    <Protected walletId={null}>
      {(password, { isLocalAuthentication }) => (
        <EnableLocalAuthenticationDone
          password={password}
          isLocalAuthentication={isLocalAuthentication}
        />
      )}
    </Protected>
  </Modal>
);

export default EnableLocalAuthentication;
