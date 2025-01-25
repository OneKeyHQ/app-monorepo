import { useEffect } from 'react';

import type { IDialogInstance } from '@onekeyhq/components';
import { Dialog, Toast } from '@onekeyhq/components';
import { usePrimePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { PrimeLoginEmailCodeDialogV2 } from '../components/PrimeLoginEmailCodeDialogV2';
import { PrimeLoginEmailDialogV2 } from '../components/PrimeLoginEmailDialogV2';

import { usePrivyUniversalV2 } from './usePrivyUniversalV2';

export function usePrimeAuthV2() {
  const [primePersistAtom] = usePrimePersistAtom();

  const { useLoginWithEmail, logout } = usePrivyUniversalV2();
  const { sendCode, loginWithCode, state } = useLoginWithEmail({
    onComplete: () => {
      console.log('🔑 ✅ User successfully logged in with email');
    },
    onError: (error) => {
      console.log(error);
    },
  });

  useEffect(() => {
    Toast.success({
      title: JSON.stringify(state),
    });
  }, [state]);

  const loginWithEmail = async () => {
    // 1. open dialog
    const dialog: IDialogInstance = Dialog.show({
      renderContent: (
        <PrimeLoginEmailDialogV2
          // 2. on email submitted
          onEmailSubmitted={async (email) => {
            // 3. open code dialog
            Dialog.show({
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

    console.log('dialog', dialog);
  };

  return { loginWithEmail, user: primePersistAtom, logout };
}
