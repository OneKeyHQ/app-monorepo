import { useLoginWithEmail, usePrivy } from '@privy-io/expo';

import type { IUsePrivyUniversalV2 } from './usePrivyUniversalV2Types';
import { Toast } from '@onekeyhq/components';

export function usePrivyUniversalV2(): IUsePrivyUniversalV2 {
  const { logout, isReady, getAccessToken, user } = usePrivy();
  const authenticated = !!user;

  return {
    useLoginWithEmail: (args) => {
      const { onComplete, onError } = args || {};
      const { sendCode, loginWithCode, state } = useLoginWithEmail({
        onSendCodeSuccess: () => {
          Toast.success({
            title: 'send code',
          });
        },
        onLoginSuccess: () => {
          onComplete?.();
        },
        onError,
      });

      return {
        state,
        sendCode: async (...sendCodeArgs) => {
          await sendCode(...sendCodeArgs);
        },
        loginWithCode: async (...loginWithCodeArgs) => {
          await loginWithCode(...loginWithCodeArgs);
        },
      };
    },
    logout,
    isReady,
    getAccessToken,
    authenticated,
    user: authenticated
      ? {
          id: user?.id || '',
        }
      : undefined,
  };
}
