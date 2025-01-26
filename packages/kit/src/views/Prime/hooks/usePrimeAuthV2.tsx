import { useEffect, useRef } from 'react';

import type { IDialogInstance } from '@onekeyhq/components';
import { Dialog, Toast } from '@onekeyhq/components';
import { usePrimePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { PrimeLoginEmailCodeDialogV2 } from '../components/PrimeLoginEmailCodeDialogV2';
import { PrimeLoginEmailDialogV2 } from '../components/PrimeLoginEmailDialogV2';

import { usePrivyUniversalV2 } from './usePrivyUniversalV2';

export function usePrimeAuthV2() {
  const [primePersistAtom] = usePrimePersistAtom();
  const emailDialogRef = useRef<IDialogInstance | undefined>(undefined);
  const emailCodeDialogRef = useRef<IDialogInstance | undefined>(undefined);

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

  async function closeDialogs() {
    await emailDialogRef.current?.close();
    await emailCodeDialogRef.current?.close();
  }

  useEffect(() => {
    if (state.status === 'sending-code') {
      Toast.success({
        title: '🔑 ✅ send code',
      });
    } else if (state.status === 'awaiting-code-input') {
      Toast.success({
        title: '🔑 ✅ awaiting code input',
      });
    } else if (state.status === 'submitting-code') {
      Toast.success({
        title: '🔑 ✅ submitting code',
      });
    } else if (state.status === 'done') {
      Toast.success({
        title: '🔑 ✅ User successfully logged in with email',
      });

      closeDialogs();
    } else if (state.status === 'error') {
      Toast.error({
        title: '🔑 ❌ User failed to log in with email',
      });
    }
  }, [state]);

  const loginWithEmail = async () => {
    // 1. open dialog
    const dialog: IDialogInstance = Dialog.show({
      renderContent: (
        <PrimeLoginEmailDialogV2
          // 2. on email submitted
          onEmailSubmitted={async (email) => {
            // 3. open code dialog
            emailCodeDialogRef.current = Dialog.show({
              renderContent: (
                // 4. input code
                <PrimeLoginEmailCodeDialogV2
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

    emailDialogRef.current = dialog;
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
