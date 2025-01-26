import { useEffect, useRef } from 'react';

import { useIntl } from 'react-intl';

import type { IDialogInstance } from '@onekeyhq/components';
import { Dialog, Toast } from '@onekeyhq/components';
import { usePrimePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { PrimeLoginEmailCodeDialogV2 } from '../components/PrimeLoginEmailCodeDialogV2';
import { PrimeLoginEmailDialogV2 } from '../components/PrimeLoginEmailDialogV2';

import { usePrivyUniversalV2 } from './usePrivyUniversalV2';

export function usePrimeAuthV2() {
  const [primePersistAtom] = usePrimePersistAtom();
  const emailDialogRef = useRef<IDialogInstance | undefined>(undefined);
  const emailCodeDialogRef = useRef<IDialogInstance | undefined>(undefined);
  const intl = useIntl();

  const { useLoginWithEmail, logout, getAccessToken, isReady, authenticated } =
    usePrivyUniversalV2();
  const { sendCode, loginWithCode, state } = useLoginWithEmail({
    onComplete: () => {
      console.log('🔑 ✅ User successfully logged in with email');
    },
    onError: (error) => {
      console.log(error);
    },
  });

  useEffect(() => {
    console.log('state.status', state.status);
    if (state.status === 'sending-code') {
      // Toast.success({
      //   title: 'send code',
      // });
    } else if (state.status === 'awaiting-code-input') {
      // Toast.success({
      //   title: 'awaiting code input',
      // });
    } else if (state.status === 'submitting-code') {
      // Toast.success({
      //   title: 'submitting code',
      // });
    }

    if (state.status === 'done') {
      // Toast.success({
      //   title: intl.formatMessage({
      //     id: ETranslations.login_welcome_message,
      //   }),
      // });

      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      emailDialogRef.current?.close();
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      emailCodeDialogRef.current?.close();
    }

    if (state.status === 'error') {
      Toast.error({
        title: intl.formatMessage({
          id: ETranslations.auth_error_passcode_incorrect,
        }),
      });
    }
  }, [intl, state.status]);

  const loginWithEmail = () => {
    Dialog.show({
      renderContent: (
        <PrimeLoginEmailDialogV2
          // 2. on email submitted
          onEmailSubmitted={async (email) => {
            // 3. open code dialog
            emailCodeDialogRef.current = Dialog.show({
              renderContent: (
                // 4. input code
                <PrimeLoginEmailCodeDialogV2
                  state={state}
                  sendCode={sendCode}
                  loginWithCode={loginWithCode}
                  email={email}
                />
              ),
            });
          }}
        />
      ),
    });
  };

  return {
    loginWithEmail,
    user: primePersistAtom,
    logout,
    getAccessToken,
    isReady,
    authenticated,
  };
}
