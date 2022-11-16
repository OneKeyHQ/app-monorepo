import React, { FC, useEffect } from 'react';

import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Center, Modal, Spinner, useToast } from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import Protected from '../../components/Protected';
import { useAppSelector } from '../../hooks/redux';

type EnableWebAuthnProps = {
  password: string;
};

const EnableWebAuthnDone: FC<EnableWebAuthnProps> = () => {
  const intl = useIntl();
  const toast = useToast();
  const enableWebAuthn = useAppSelector((s) => s.settings.enableWebAuthn);

  const navigation = useNavigation();
  useEffect(() => {
    async function main() {
      let result = false;
      if (enableWebAuthn) {
        result = await backgroundApiProxy.serviceSetting.disableWebAuthn();
      } else {
        result = await backgroundApiProxy.serviceSetting.enableWebAuthn();
      }
      if (result) {
        toast.show({ title: intl.formatMessage({ id: 'msg__success' }) });
      } else {
        toast.show({ title: intl.formatMessage({ id: 'msg__unknown_error' }) });
      }
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

export const EnableWebAuthn = () => (
  <Modal footer={null}>
    <Protected walletId={null}>
      {(password) => <EnableWebAuthnDone password={password} />}
    </Protected>
  </Modal>
);

export default EnableWebAuthn;
