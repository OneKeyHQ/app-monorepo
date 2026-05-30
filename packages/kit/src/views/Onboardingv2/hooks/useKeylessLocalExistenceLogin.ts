import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import type { IDialogInstance } from '@onekeyhq/components';
import { Dialog, Toast } from '@onekeyhq/components';
import { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useKeylessWallet } from '../../../components/KeylessWallet/useKeylessWallet';
import { useOneKeyAuth } from '../../../components/OneKeyAuth/useOneKeyAuth';

const PROVIDER_PLATFORM_NAME: Record<EOAuthSocialLoginProvider, string> = {
  [EOAuthSocialLoginProvider.Google]: 'Google',
  [EOAuthSocialLoginProvider.Apple]: 'Apple',
};

// Shared hook for the "check local keyless existence then continue" entry flow
// used by CreateNewWallet and CreateOrImportWallet. When autoLoginKeylessProvider
// is set (extension side-panel auto-login), a blocking Dialog.loading covers the
// OAuth round-trip so the user sees progress even though they didn't click.
export function useKeylessLocalExistenceLogin({
  autoLoginKeylessProvider,
  isResetMode,
  onResetModeChange,
}: {
  autoLoginKeylessProvider?: EOAuthSocialLoginProvider;
  isResetMode?: boolean;
  onResetModeChange?: (val: boolean) => void;
} = {}) {
  const intl = useIntl();
  const { enableKeylessWalletLoading, checkKeylessWalletLocalExistence } =
    useKeylessWallet();
  const { signInWithSocialLogin } = useOneKeyAuth();

  const [loadingProvider, setLoadingProvider] =
    useState<EOAuthSocialLoginProvider | null>(null);
  const loadingDialogRef = useRef<IDialogInstance | null>(null);
  // Synchronous re-entrancy guard. setLoadingProvider is async React state, so
  // a same-frame double click or a click on the other provider before the
  // state commits could otherwise launch two concurrent OAuth round-trips (or
  // two concurrent destructive resets) and let the later response overwrite the
  // earlier success / reset-mode UI state.
  const isHandlingLoginRef = useRef(false);

  useEffect(
    () => () => {
      void loadingDialogRef.current?.close();
    },
    [],
  );

  const handleLogin = useCallback(
    async (provider: EOAuthSocialLoginProvider) => {
      if (isHandlingLoginRef.current) {
        return;
      }
      isHandlingLoginRef.current = true;
      setLoadingProvider(provider);
      try {
        if (!isResetMode) {
          defaultLogger.account.wallet.onboard({
            onboardMethod: 'createKeylessWallet',
          });
        }
        if (autoLoginKeylessProvider) {
          const platform = PROVIDER_PLATFORM_NAME[provider];
          loadingDialogRef.current = Dialog.loading({
            title: intl.formatMessage(
              { id: ETranslations.continue_with_social_platform },
              { platform },
            ),
            description: intl.formatMessage(
              { id: ETranslations.extension_connecting_platform_account },
              { platform },
            ),
          });
        }
        if (isResetMode) {
          const result = await signInWithSocialLogin(provider);
          if (result?.session?.accessToken) {
            await backgroundApiProxy.serviceKeylessWallet.apiResetKeylessBackendShare(
              {
                token: result.session.accessToken,
              },
            );
            Toast.success({
              title: 'Reset Success',
            });
            onResetModeChange?.(false);
          }
          return;
        }
        await checkKeylessWalletLocalExistence({ signInProvider: provider });
      } finally {
        isHandlingLoginRef.current = false;
        setLoadingProvider(null);
        void loadingDialogRef.current?.close();
      }
    },
    [
      autoLoginKeylessProvider,
      checkKeylessWalletLocalExistence,
      intl,
      isResetMode,
      onResetModeChange,
      signInWithSocialLogin,
    ],
  );

  const handleGoogleLogin = useCallback(
    () => handleLogin(EOAuthSocialLoginProvider.Google),
    [handleLogin],
  );
  const handleAppleLogin = useCallback(
    () => handleLogin(EOAuthSocialLoginProvider.Apple),
    [handleLogin],
  );

  return useMemo(
    () => ({
      enableKeylessWalletLoading,
      loadingProvider,
      handleGoogleLogin,
      handleAppleLogin,
    }),
    [
      enableKeylessWalletLoading,
      loadingProvider,
      handleGoogleLogin,
      handleAppleLogin,
    ],
  );
}
