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
import type { IKeylessOAuthSessionRollbackHandle } from '@onekeyhq/shared/types/prime/identityExitTypes';

export function isOneKeyIdLocalKeylessOAuthMode(
  status?: EOneKeyIdLoginWithLocalKeylessPrepareStatus,
) {
  return (
    status ===
      EOneKeyIdLoginWithLocalKeylessPrepareStatus.ContinueWithKeyless ||
    status === EOneKeyIdLoginWithLocalKeylessPrepareStatus.NeedOAuthLogin
  );
}

export type IOneKeyIdLocalKeylessOAuthContext = {
  walletId: string;
  provider: EOAuthSocialLoginProvider;
};

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
  const { signInWithSocialLogin, persistKeylessOAuthSession } = useOneKeyAuth();
  const localKeylessPrepareStatus = localKeylessLoginPrepareResult?.status;
  const localKeylessProvider = localKeylessLoginPrepareResult?.provider;
  const localKeylessWalletId = localKeylessLoginPrepareResult?.walletId;
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
    async ({
      accessToken,
      forceValidation,
      expectedProvider,
    }: {
      accessToken: string;
      forceValidation?: boolean;
      expectedProvider?: EOAuthSocialLoginProvider;
    }) => {
      if (!isLocalKeylessOAuthMode && !forceValidation) {
        return;
      }
      const { isValid } =
        await backgroundApiProxy.serviceKeylessWallet.validateTokenMatchesKeylessWallet(
          { token: accessToken },
        );
      if (!isValid) {
        showKeylessWalletAccountMismatchError({
          intl,
          keylessProvider: expectedProvider ?? localKeylessProvider,
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

  const getInteractiveOAuthTokens = useCallback(
    async ({
      provider,
      missingTokenMessage,
    }: {
      provider: EOAuthSocialLoginProvider;
      missingTokenMessage: string;
    }) => {
      const result = await signInWithSocialLogin(provider);
      const accessToken = result?.session?.accessToken || '';
      const refreshToken = result?.session?.refreshToken || '';
      if (!accessToken) {
        throw new OneKeyLocalError(missingTokenMessage);
      }
      return {
        accessToken,
        refreshToken,
      };
    },
    [signInWithSocialLogin],
  );

  const getOAuthAccessToken = useCallback(
    async ({
      provider,
      missingTokenMessage,
      localKeylessContext,
    }: {
      provider: EOAuthSocialLoginProvider;
      missingTokenMessage: string;
      localKeylessContext?: IOneKeyIdLocalKeylessOAuthContext;
    }) => {
      let accessToken = '';
      let didUseOAuthSignIn = false;
      let rollbackHandle: IKeylessOAuthSessionRollbackHandle | undefined;
      const effectiveLocalKeylessProvider =
        localKeylessContext?.provider ?? localKeylessProvider;
      const effectiveLocalKeylessWalletId =
        localKeylessContext?.walletId ?? localKeylessWalletId;
      const shouldValidateLocalKeyless = Boolean(
        localKeylessContext || isLocalKeylessOAuthMode,
      );
      const shouldTryLocalKeylessSession =
        shouldValidateLocalKeyless &&
        provider === effectiveLocalKeylessProvider;

      if (shouldTryLocalKeylessSession) {
        let localSessionResult:
          | Awaited<
              ReturnType<
                typeof backgroundApiProxy.serviceKeylessWallet.continueOneKeyIdLoginWithLocalKeyless
              >
            >
          | undefined;
        try {
          localSessionResult =
            await backgroundApiProxy.serviceKeylessWallet.continueOneKeyIdLoginWithLocalKeyless();
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
        if (localSessionResult) {
          if (
            localSessionResult.provider !== provider ||
            (effectiveLocalKeylessWalletId &&
              localSessionResult.walletId !== effectiveLocalKeylessWalletId)
          ) {
            throw new OneKeyLocalError(
              'Local Keyless wallet changed before OneKey ID login could continue.',
            );
          }
          accessToken = localSessionResult.accessToken;
        }
      }

      if (!accessToken) {
        // Sign in WITHOUT persisting the OAuth session: there is a single
        // shared keyless session slot, and persisting before validation
        // would let a wrong-account session overwrite the still-valid one
        // (see the persistKeylessOAuthSession contract in useSupabaseAuth).
        const interactiveTokens = await getInteractiveOAuthTokens({
          provider,
          missingTokenMessage,
        });
        accessToken = interactiveTokens.accessToken;
        didUseOAuthSignIn = true;
        // Throws on mismatch. Nothing has been persisted yet, so the
        // previously persisted keyless session stays intact and no cleanup
        // is needed here.
        await assertTokenMatchesLocalKeylessWallet({
          accessToken,
          forceValidation: Boolean(localKeylessContext),
          expectedProvider: effectiveLocalKeylessProvider,
        });
        // No OneKey ID account-conflict check is needed before persisting
        // here (unlike checkKeylessWalletCreatedOnServer): both hosts of
        // this hook guarantee no live KeylessOAuth-backed OneKey ID login
        // exists at this point — PrimeLoginOAuthDialog only renders after
        // showOneKeyIdLoginDialog logged out / cleared the OneKey ID state,
        // and OneKeyIdLegacyOAuthBind runs only for LegacyEmailSupabase-
        // sourced logins, whose session does not live in the keyless slot.
        const persisted = await persistKeylessOAuthSession({
          accessToken,
          refreshToken: interactiveTokens.refreshToken,
        });
        rollbackHandle = persisted.rollbackHandle;
      }

      return {
        accessToken,
        didUseOAuthSignIn,
        rollbackHandle,
      };
    },
    [
      assertTokenMatchesLocalKeylessWallet,
      getInteractiveOAuthTokens,
      isLocalKeylessOAuthMode,
      localKeylessProvider,
      localKeylessWalletId,
      persistKeylessOAuthSession,
    ],
  );

  const getFreshOAuthTokensForRegularLogin = useCallback(
    async ({
      provider,
      missingTokenMessage,
    }: {
      provider: EOAuthSocialLoginProvider;
      missingTokenMessage: string;
    }) => {
      const { accessToken, refreshToken } = await getInteractiveOAuthTokens({
        provider,
        missingTokenMessage,
      });
      if (!refreshToken) {
        // TODO: i18n
        throw new OneKeyLocalError(
          'OAuth login failed: refresh token not found',
        );
      }
      return {
        accessToken,
        refreshToken,
      };
    },
    [getInteractiveOAuthTokens],
  );

  const rollbackProvisionalOAuthSession = useCallback(
    async ({
      rollbackHandle,
    }: {
      rollbackHandle: IKeylessOAuthSessionRollbackHandle;
    }) =>
      backgroundApiProxy.servicePrime.rollbackProvisionalKeylessOAuthSession({
        rollbackHandle,
      }),
    [],
  );

  return {
    localKeylessPrepareStatus,
    localKeylessProvider,
    localKeylessWalletId,
    localKeylessProviderName,
    isLocalKeylessOAuthMode,
    canContinueWithLocalKeyless,
    shouldShowProvider,
    getOAuthAccessToken,
    getFreshOAuthTokensForRegularLogin,
    rollbackProvisionalOAuthSession,
  };
}
