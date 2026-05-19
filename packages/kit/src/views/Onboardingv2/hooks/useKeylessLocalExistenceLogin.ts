import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import type { IDialogInstance } from '@onekeyhq/components';
import { Dialog } from '@onekeyhq/components';
import { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { useKeylessWallet } from '../../../components/KeylessWallet/useKeylessWallet';

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
}: {
  autoLoginKeylessProvider?: EOAuthSocialLoginProvider;
} = {}) {
  const intl = useIntl();
  const { enableKeylessWalletLoading, checkKeylessWalletLocalExistence } =
    useKeylessWallet();

  const [loadingProvider, setLoadingProvider] =
    useState<EOAuthSocialLoginProvider | null>(null);
  const loadingDialogRef = useRef<IDialogInstance | null>(null);

  useEffect(
    () => () => {
      void loadingDialogRef.current?.close();
    },
    [],
  );

  const handleLogin = useCallback(
    async (provider: EOAuthSocialLoginProvider) => {
      setLoadingProvider(provider);
      try {
        defaultLogger.account.wallet.onboard({
          onboardMethod: 'createKeylessWallet',
        });
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
        await checkKeylessWalletLocalExistence({ signInProvider: provider });
      } finally {
        setLoadingProvider(null);
        void loadingDialogRef.current?.close();
      }
    },
    [checkKeylessWalletLocalExistence, intl, autoLoginKeylessProvider],
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
