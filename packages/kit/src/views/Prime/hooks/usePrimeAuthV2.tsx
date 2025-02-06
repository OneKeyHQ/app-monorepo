import { useEffect, useRef } from 'react';

import type { IDialogInstance } from '@onekeyhq/components';
import { Dialog } from '@onekeyhq/components';
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

  useEffect(() => {
    if (state.status === 'done') {
      void emailDialogRef.current?.close();
      void emailCodeDialogRef.current?.close();
    }
  }, [state.status]);

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
