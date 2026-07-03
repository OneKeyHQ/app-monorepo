import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { showKeylessWalletAccountMismatchError } from '@onekeyhq/kit/src/components/KeylessWallet/AccountMismatchDialog';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EOneKeyIdLoginWithLocalKeylessPrepareStatus,
  type IOneKeyIdLoginWithLocalKeylessPrepareResult,
} from '@onekeyhq/shared/src/keylessWallet/keylessWalletTypes';
import { ETranslations } from '@onekeyhq/shared/src/locale';

function getLocalKeylessOAuthProviderName(
  provider?: EOAuthSocialLoginProvider,
) {
  if (!provider) {
    return '';
  }
  return provider === EOAuthSocialLoginProvider.Google ? 'Google' : 'Apple';
}

export function isOneKeyIdLocalKeylessOAuthMode(
  status?: EOneKeyIdLoginWithLocalKeylessPrepareStatus,
) {
  return (
    status ===
      EOneKeyIdLoginWithLocalKeylessPrepareStatus.ContinueWithKeyless ||
    status === EOneKeyIdLoginWithLocalKeylessPrepareStatus.NeedOAuthLogin
  );
}

export function useOneKeyIdLocalKeylessOAuth({
  localKeylessLoginPrepareResult,
  onAccountMismatch,
  forceAccountMismatchToast,
}: {
  localKeylessLoginPrepareResult?: IOneKeyIdLoginWithLocalKeylessPrepareResult | null;
  onAccountMismatch?: () => void;
  forceAccountMismatchToast?: boolean;
}) {
  const intl = useIntl();
  const { signInWithSocialLogin, keylessSupabaseSignOut } = useOneKeyAuth();
  const localKeylessPrepareStatus = localKeylessLoginPrepareResult?.status;
  const localKeylessProvider = localKeylessLoginPrepareResult?.provider;
  const isLocalKeylessOAuthMode = isOneKeyIdLocalKeylessOAuthMode(
    localKeylessPrepareStatus,
  );
  const canContinueWithLocalKeyless =
    localKeylessPrepareStatus ===
      EOneKeyIdLoginWithLocalKeylessPrepareStatus.ContinueWithKeyless &&
    Boolean(localKeylessProvider);

  const localKeylessProviderName = useMemo(
    () => getLocalKeylessOAuthProviderName(localKeylessProvider),
    [localKeylessProvider],
  );

  const shouldShowProvider = useCallback(
    (provider: EOAuthSocialLoginProvider) =>
      !localKeylessProvider || localKeylessProvider === provider,
    [localKeylessProvider],
  );

  const assertTokenMatchesLocalKeylessWallet = useCallback(
    async ({ accessToken }: { accessToken: string }) => {
      if (!isLocalKeylessOAuthMode) {
        return;
      }
      const { isValid } =
        await backgroundApiProxy.serviceKeylessWallet.validateTokenMatchesKeylessWallet(
          { token: accessToken },
        );
      if (!isValid) {
        showKeylessWalletAccountMismatchError({
          intl,
          keylessProvider: localKeylessProvider,
          forceToast: forceAccountMismatchToast,
        });
        onAccountMismatch?.();
        throw new OneKeyLocalError({
          message: intl.formatMessage({
            id: ETranslations.keyless_wallet_verify_pin_account_mismatch_desc,
          }),
          autoToast: false,
        });
      }
    },
    [
      forceAccountMismatchToast,
      intl,
      isLocalKeylessOAuthMode,
      localKeylessProvider,
      onAccountMismatch,
    ],
  );

  const getOAuthAccessToken = useCallback(
    async ({
      provider,
      missingTokenMessage,
    }: {
      provider: EOAuthSocialLoginProvider;
      missingTokenMessage: string;
    }) => {
      let accessToken = '';
      let didUseOAuthSignIn = false;
      const shouldTryLocalKeylessSession =
        isLocalKeylessOAuthMode && provider === localKeylessProvider;

      if (shouldTryLocalKeylessSession) {
        try {
          const result =
            await backgroundApiProxy.serviceKeylessWallet.continueOneKeyIdLoginWithLocalKeyless();
          accessToken = result.accessToken;
        } catch {
          accessToken = '';
        }
      }

      if (!accessToken) {
        const result = await signInWithSocialLogin(provider, {
          persistSession: true,
        });
        accessToken = result?.session?.accessToken || '';
        if (!accessToken) {
          throw new OneKeyLocalError(missingTokenMessage);
        }
        didUseOAuthSignIn = true;
        try {
          await assertTokenMatchesLocalKeylessWallet({ accessToken });
        } catch (error) {
          if (isLocalKeylessOAuthMode) {
            await keylessSupabaseSignOut();
            await backgroundApiProxy.simpleDb.prime.clearKeylessAuthSession();
          }
          throw error;
        }
      }

      return {
        accessToken,
        didUseOAuthSignIn,
      };
    },
    [
      assertTokenMatchesLocalKeylessWallet,
      isLocalKeylessOAuthMode,
      localKeylessProvider,
      keylessSupabaseSignOut,
      signInWithSocialLogin,
    ],
  );

  const clearOAuthSignInTempSession = useCallback(async () => {
    await keylessSupabaseSignOut();
    await backgroundApiProxy.simpleDb.prime.clearKeylessAuthSession();
  }, [keylessSupabaseSignOut]);

  return {
    localKeylessPrepareStatus,
    localKeylessProvider,
    localKeylessProviderName,
    isLocalKeylessOAuthMode,
    canContinueWithLocalKeyless,
    shouldShowProvider,
    getOAuthAccessToken,
    clearOAuthSignInTempSession,
  };
}
