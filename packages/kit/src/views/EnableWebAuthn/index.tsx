/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call  */
import React, { FC, useEffect } from 'react';

import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Center, Modal, Spinner, useToast } from '@onekeyhq/components';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import Protected from '../../components/Protected';
import { useAppSelector } from '../../hooks/redux';
import {
  disableWebAuthn as disableWebAuthnCall,
  enableWebAuthn as enableWebAuthnCall,
} from '../../utils/webauthn';

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
      try {
        if (enableWebAuthn) {
          disableWebAuthnCall();
        } else {
          await enableWebAuthnCall();
        }
        toast.show({ title: intl.formatMessage({ id: 'msg__success' }) });
      } catch (e: any) {
        debugLogger.common.error(e.message);
        if (
          !e.message.includes(
            'The operation either timed out or was not allowed',
          )
        ) {
          toast.show({
            title: intl.formatMessage({ id: 'msg__unknown_error' }),
          });
        }
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
