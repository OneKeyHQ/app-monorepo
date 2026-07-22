import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { showKeylessWalletAccountMismatchError } from '@onekeyhq/kit/src/components/KeylessWallet/AccountMismatchDialog';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import type { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import {
  EOneKeyIdLoginWithLocalKeylessPrepareStatus,
  type IOneKeyIdLoginWithLocalKeylessPrepareResult,
} from '@onekeyhq/shared/src/keylessWallet/keylessWalletTypes';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { getOAuthSocialLoginProviderName } from '@onekeyhq/shared/src/utils/oauthProviderUtils';

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
  const {
    signInWithSocialLogin,
    keylessSupabaseSignOut,
    persistKeylessOAuthSession,
  } = useOneKeyAuth();
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
    () => getOAuthSocialLoginProviderName(localKeylessProvider),
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

  // Clear the temporary keyless OAuth session persisted by
  // signInWithSocialLogin (main runtime client sign-out + bg-side shared
  // storage). The bg method is source-guarded: when the OneKey ID login is
  // backed by the keyless session (authSessionSource === KeylessOAuth), it
  // also clears the auth tokens and the logged-in atom so clearing the
  // session can never leave a zombie logged-in state behind.
  const clearOAuthSignInTempSession = useCallback(async () => {
    await keylessSupabaseSignOut();
    await backgroundApiProxy.serviceKeylessWallet.clearKeylessAuthSessionAndLoginState();
  }, [keylessSupabaseSignOut]);

  const getOAuthAccessToken = useCallback(
    async ({
      provider,
      missingTokenMessage,
      persistLegacyBindGuard,
    }: {
      provider: EOAuthSocialLoginProvider;
      missingTokenMessage: string;
      // Host-supplied guard for persisting the fresh OAuth session into the
      // SINGLE shared keyless slot: forwarded to the bg-owned persist
      // (ServicePrime.persistKeylessOAuthSession), which re-asserts the
      // legacy bind preconditions INSIDE the same loginMutex section that
      // writes the slot. Hosts whose flow depends on state that can change
      // during the user-paced OAuth round-trip (the legacy bind's login
      // preconditions) thus abort atomically with the write — a guard
      // failure always means the slot was left untouched, and no concurrent
      // login commit can land between the check and the write.
      persistLegacyBindGuard?: { expectedOnekeyUserId: string };
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
        } catch (error) {
          // Dead/expired legacy blob -> fall back to a fresh OAuth
          // round-trip below. But a user-initiated cancel (the legacy-blob
          // migration's passcode prompt was dismissed) must settle the flow
          // instead — a "Cancel" click must never escalate into opening the
          // system browser. Both hosts skip toasts for cancel-style errors
          // (errorToastUtils.isUserCancelStyleError), so rethrowing is
          // silent there.
          if (errorToastUtils.isUserCancelStyleError(error)) {
            throw error;
          }
          accessToken = '';
        }
      }

      if (!accessToken) {
        // Sign in WITHOUT persisting the OAuth session: there is a single
        // shared keyless session slot, and persisting before validation
        // would let a wrong-account session overwrite the still-valid one
        // (see the persistKeylessOAuthSession contract in useSupabaseAuth).
        const result = await signInWithSocialLogin(provider);
        accessToken = result?.session?.accessToken || '';
        const refreshToken = result?.session?.refreshToken || '';
        if (!accessToken) {
          throw new OneKeyLocalError(missingTokenMessage);
        }
        didUseOAuthSignIn = true;
        // Throws on mismatch. Nothing has been persisted yet, so the
        // previously persisted keyless session stays intact and no cleanup
        // is needed here.
        await assertTokenMatchesLocalKeylessWallet({ accessToken });
        // No generic OneKey ID account-conflict check is needed before
        // persisting here (unlike checkKeylessWalletCreatedOnServer): both
        // hosts of this hook start from a state where no live
        // KeylessOAuth-backed OneKey ID login exists —
        // PrimeLoginOAuthDialog only renders after showOneKeyIdLoginDialog
        // logged out / cleared the OneKey ID state, and
        // OneKeyIdLegacyOAuthBind runs only for LegacyEmailSupabase-sourced
        // logins, whose session does not live in the keyless slot. That
        // starting state can however be invalidated DURING the user-paced
        // OAuth round-trip by a concurrent surface (e.g. a KeylessOAuth
        // login committing into this shared slot); hosts with such a
        // dependency pass persistLegacyBindGuard, which the bg-owned
        // persist re-asserts atomically with the slot write.
        await persistKeylessOAuthSession({
          accessToken,
          refreshToken,
          legacyBindGuard: persistLegacyBindGuard,
        });
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
      persistKeylessOAuthSession,
      signInWithSocialLogin,
    ],
  );

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
