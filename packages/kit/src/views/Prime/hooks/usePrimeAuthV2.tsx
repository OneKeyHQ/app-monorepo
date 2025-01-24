import type { IDialogInstance } from '@onekeyhq/components';
import { Dialog } from '@onekeyhq/components';

import { PrimeLoginEmailCodeDialogV2 } from '../components/PrimeLoginEmailCodeDialogV2';
import { PrimeLoginEmailDialogV2 } from '../components/PrimeLoginEmailDialogV2';

import { usePrivyUniversalV2 } from './usePrivyUniversalV2';

export function usePrimeAuthV2() {
  // const emailDialogRef = useRef<IDialogInstance | undefined>(undefined);
  // const emailCodeDialogRef = useRef<IDialogInstance | undefined>(undefined);
  const { useLoginWithEmail } = usePrivyUniversalV2();
  const { sendCode, loginWithCode } = useLoginWithEmail({
    onComplete: ({ user, isNewUser, wasAlreadyAuthenticated, loginMethod }) => {
      console.log('🔑 ✅ User successfully logged in with email', {
        user,
        isNewUser,
        wasAlreadyAuthenticated,
        loginMethod,
      });
    },
    onError: (error) => {
      console.log(error);
    },
  });

  const loginWithEmail = async () => {
    // open dialog
    const dialog: IDialogInstance = Dialog.show({
      renderContent: (
        <PrimeLoginEmailDialogV2
          // on email submitted
          onEmailSubmitted={async (email) => {
            // open code dialog
            Dialog.show({
              renderContent: (
                // input code
                <PrimeLoginEmailCodeDialogV2
                  loginWithCode={loginWithCode}
                  email={email}
                />
              ),
            });

            await sendCode({ email });
          }}
        />
      ),
    });

    console.log('dialog', dialog);
  };

  return { loginWithEmail };
}
