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
    const dialog: IDialogInstance = Dialog.show({
      renderContent: (
        <PrimeLoginEmailDialogV2
          onEmailSubmitted={async (email) => {
            Dialog.show({
              renderContent: (
                <PrimeLoginEmailCodeDialogV2
                  loginWithCode={loginWithCode}
                  email={email}
                />
              ),
              onClose: async () => {},
            });

            await sendCode({ email });
          }}
        />
      ),
      onClose: async () => {},
    });

    console.log('dialog', dialog);
  };

  return { loginWithEmail };
}
