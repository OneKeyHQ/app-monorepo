import { useCallback, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import type { IDialogInstance } from '@onekeyhq/components';
import {
  Dialog,
  SizableText,
  Toast,
  YStack,
  rootNavigationRef,
} from '@onekeyhq/components';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import {
  useDevSettingsPersistAtom,
  useKeylessLastCancelVerifyPinTimeAtom,
  useKeylessPinConfirmStatusAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { devSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';
import {
  IncorrectPinError,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import { EKeylessFinalizeAction } from '@onekeyhq/shared/src/keylessWallet/keylessWalletConsts';
import {
  EKeylessCreateWithOneKeyIdPrepareStatus,
  EKeylessOAuthAccessTokenRefreshStatus,
  ELocalKeylessWalletOAuthState,
  type IKeylessCreateWithOneKeyIdPrepareResult,
} from '@onekeyhq/shared/src/keylessWallet/keylessWalletTypes';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ERootRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';
import {
  EOnboardingPagesV2,
  EOnboardingV2OneKeyIDLoginMode,
  EOnboardingV2Routes,
} from '@onekeyhq/shared/src/routes/onboardingv2';
import cacheUtils from '@onekeyhq/shared/src/utils/cacheUtils';
import { shouldClearKeylessOAuthSessionAfterError } from '@onekeyhq/shared/src/utils/keylessOAuthSessionUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../hooks/useAppNavigation';
import { usePromiseResult } from '../../hooks/usePromiseResult';
import { showOneKeyIdLegacyOAuthBindDialog } from '../../views/Prime/components/OneKeyIdLegacyOAuthBind/OneKeyIdLegacyOAuthBind';
import {
  getSanitizedAuthErrorText,
  logOneKeyIdLoginFailureReason,
  markOneKeyIdFailureServerLogged,
  showOneKeyIdLoginFailedToast,
  throwLocalizedOneKeyIdLoginError,
} from '../../views/Prime/components/oneKeyIdLoginToastUtils';
import {
  redirectKeylessOneKeyIdAuthToExtExpandTab,
  shouldRunOneKeyIdAuthInExtExpandTab,
} from '../OneKeyAuth/extOneKeyIdAuthExpandTab';
import { getDisplayEmailOrUnknown } from '../OneKeyAuth/oneKeyIdDisplayEmailUtils';
import { useIdentityExitFlow } from '../OneKeyAuth/useIdentityExitFlow';
import { useOneKeyAuth } from '../OneKeyAuth/useOneKeyAuth';

import {
  showKeylessOAuthRefreshRecoveryDialog,
  showKeylessOneKeyIdSessionConflictDialog,
  showKeylessWalletAccountMismatchError,
  showOneKeyIdOAuthAccountMismatchDialog,
} from './AccountMismatchDialog';
import {
  getPromotedSameEmailAccountStatusAfterAutoRetryRateLimit,
  isKeylessSameEmailAutoRetryRateLimitError,
} from './sameEmailAccountStatusUtils';

import type { IKeylessSameEmailAccountStatus } from './sameEmailAccountStatusUtils';

export function useKeylessWalletFeatureIsEnabled(): boolean {
  return !platformEnv.isNativeIOSMacCatalyst;
}

export function useKeylessWalletExistsLocal(): boolean {
  const isKeylessWalletEnabled = useKeylessWalletFeatureIsEnabled();
  const { result } = usePromiseResult(async () => {
    if (!isKeylessWalletEnabled) {
      return false;
    }
    return backgroundApiProxy.serviceAccount.isKeylessWalletExistsLocal();
  }, [isKeylessWalletEnabled]);
  return result ?? false;
}

export const keylessOnboardingCache = new cacheUtils.LRUCache<string, string>({
  max: 1000,
  ttl: timerUtils.getTimeDurationMs({ minute: 8 }),
  ttlAutopurge: true,
});

type IKeylessOnboardingRealmTokenState =
  | 'readyForNextExchange'
  | 'refreshRequired';

async function keylessOnboardingCacheGet(key: string) {
  const token = keylessOnboardingCache.get(key);
  if (!token) {
    return '';
  }
  return backgroundApiProxy.servicePassword.decodeSensitiveText({
    encodedText: token,
  });
}

async function keylessOnboardingCacheSet(key: string, value: string) {
  keylessOnboardingCache.set(
    key,
    await backgroundApiProxy.servicePassword.encodeSensitiveText({
      text: value,
    }),
  );
}

async function cacheKeylessOnboardingToken({
  token,
  provider,
  realmTokenState,
}: {
  token: string;
  provider?: EOAuthSocialLoginProvider;
  realmTokenState?: IKeylessOnboardingRealmTokenState;
}) {
  await keylessOnboardingCacheSet('socialLoginToken', token);
  if (provider) {
    await keylessOnboardingCacheSet('socialLoginProvider', provider);
  }
  if (realmTokenState) {
    await keylessOnboardingCacheSet('realmTokenState', realmTokenState);
  } else if (!(await keylessOnboardingCacheGet('realmTokenState'))) {
    await keylessOnboardingCacheSet('realmTokenState', 'refreshRequired');
  }
}

function clearKeylessOnboardingToken() {
  keylessOnboardingCache.delete('socialLoginToken');
  keylessOnboardingCache.delete('socialLoginProvider');
  keylessOnboardingCache.delete('realmTokenState');
}

async function getKeylessOnboardingToken() {
  const token = keylessOnboardingCacheGet('socialLoginToken');
  return token;
}

async function getKeylessOnboardingProvider() {
  const provider = await keylessOnboardingCacheGet('socialLoginProvider');
  if (
    provider === EOAuthSocialLoginProvider.Google ||
    provider === EOAuthSocialLoginProvider.Apple
  ) {
    return provider;
  }
  return undefined;
}

async function getKeylessOnboardingRealmTokenState(): Promise<IKeylessOnboardingRealmTokenState> {
  const state = await keylessOnboardingCacheGet('realmTokenState');
  return state === 'readyForNextExchange'
    ? 'readyForNextExchange'
    : 'refreshRequired';
}

async function cacheKeylessOnboardingPin({ pin }: { pin: string }) {
  await keylessOnboardingCacheSet('onboardingPin', pin);
}

export async function getKeylessOnboardingPin() {
  const pin = keylessOnboardingCacheGet('onboardingPin');
  return pin;
}

async function cacheKeylessOnboardingPinConfirmStatusUpdated({
  updated,
}: {
  updated: boolean;
}) {
  await keylessOnboardingCacheSet(
    'pinConfirmStatusUpdated',
    updated ? 'true' : 'false',
  );
}

async function getKeylessOnboardingPinConfirmStatusUpdated() {
  return (
    (await keylessOnboardingCacheGet('pinConfirmStatusUpdated')) === 'true'
  );
}

async function cacheKeylessOnboardingSameEmailAccountStatus({
  status,
}: {
  status: IKeylessSameEmailAccountStatus;
}) {
  await keylessOnboardingCacheSet(
    'sameEmailAccountStatus',
    JSON.stringify(status),
  );
}

export async function getKeylessOnboardingSameEmailAccountStatus(): Promise<IKeylessSameEmailAccountStatus> {
  const raw = await keylessOnboardingCacheGet('sameEmailAccountStatus');
  if (!raw) {
    return {
      isSameEmailAccountAtOldVersion: false,
    };
  }

  try {
    const status = JSON.parse(raw) as IKeylessSameEmailAccountStatus;
    return {
      isSameEmailAccountAtOldVersion: !!status?.isSameEmailAccountAtOldVersion,
      retryProvider: status?.retryProvider,
      currentProvider: status?.currentProvider,
    };
  } catch (error) {
    logOneKeyIdLoginFailureReason(
      `Keyless onboarding same-email status parse failed: ${getSanitizedAuthErrorText(
        error,
      )}`,
      error,
    );
    return {
      isSameEmailAccountAtOldVersion: false,
    };
  }
}

async function promoteKeylessOnboardingSameEmailRetryProviderAfterRateLimit({
  status,
}: {
  status: IKeylessSameEmailAccountStatus;
}) {
  const nextStatus =
    getPromotedSameEmailAccountStatusAfterAutoRetryRateLimit(status);

  if (!nextStatus) {
    return;
  }

  await cacheKeylessOnboardingSameEmailAccountStatus({
    status: nextStatus,
  });
}

async function shouldPromoteKeylessOnboardingSameEmailRetryProviderAfterRateLimit({
  token,
  error,
}: {
  token: string;
  error: unknown;
}) {
  if (!isKeylessSameEmailAutoRetryRateLimitError(error)) {
    return false;
  }

  try {
    const result =
      await backgroundApiProxy.serviceKeylessWallet.apiCheckRateLimitStatus({
        token,
      });

    return result.isRateLimited && result.retryAfterSeconds > 0;
  } catch (statusError) {
    logOneKeyIdLoginFailureReason(
      `Keyless onboarding rate-limit status check failed: ${getSanitizedAuthErrorText(
        statusError,
      )}`,
      statusError,
    );
    return false;
  }
}

async function syncKeylessOnboardingSameEmailRetryProviderAfterRateLimit({
  token,
  error,
  status,
}: {
  token: string;
  error: unknown;
  status: IKeylessSameEmailAccountStatus;
}) {
  try {
    if (
      await shouldPromoteKeylessOnboardingSameEmailRetryProviderAfterRateLimit({
        token,
        error,
      })
    ) {
      await promoteKeylessOnboardingSameEmailRetryProviderAfterRateLimit({
        status,
      });
    }
  } catch (syncError) {
    logOneKeyIdLoginFailureReason(
      `Keyless onboarding same-email retry provider sync failed: ${getSanitizedAuthErrorText(
        syncError,
      )}`,
      syncError,
    );
  }
}

async function cacheKeylessOnboardingCustomMnemonic({
  customMnemonic,
}: {
  customMnemonic: string;
}) {
  const devSettings = await devSettingsPersistAtom.get();
  if (devSettings.enabled) {
    await keylessOnboardingCacheSet('customMnemonic', customMnemonic);
  }
}

async function getKeylessOnboardingCustomMnemonic() {
  const devSettings = await devSettingsPersistAtom.get();
  if (devSettings.enabled) {
    const customMnemonic = keylessOnboardingCacheGet('customMnemonic');
    return customMnemonic;
  }
}

if (process.env.NODE_ENV !== 'production') {
  // @ts-ignore
  globalThis.$$keylessOnboardingCache = keylessOnboardingCache;
}

export function useKeylessWallet() {
  const { signInWithSocialLogin, persistKeylessOAuthSession } = useOneKeyAuth();
  const { run: runIdentityExit } = useIdentityExitFlow();
  const navigation = useAppNavigation();
  const intl = useIntl();

  const [enableKeylessWalletLoading, setEnableKeylessWalletLoading] =
    useState(false);
  const enableKeylessWalletLoadingRef = useRef(enableKeylessWalletLoading);
  enableKeylessWalletLoadingRef.current = enableKeylessWalletLoading;

  const handleKeylessOnboardingTimeout = useCallback(() => {
    // Dialog also invokes user onClose after a confirm-close, so onConfirm
    // and onClose would both fire for a single "Got it" tap and pop the
    // stack twice (~300ms apart), dismissing an unrelated screen below.
    // Guard with a closure flag so cleanup + popStack run at most once
    // across the three callbacks.
    let handled = false;
    const handleDialogDismiss = () => {
      if (handled) {
        return;
      }
      handled = true;
      keylessOnboardingCache.clear();
      navigation.popStack();
    };
    Dialog.show({
      title: intl.formatMessage({
        id: ETranslations.create_keyless_wallet_session_expired,
      }),
      description: intl.formatMessage({
        id: ETranslations.create_keyless_wallet_session_expired_desc,
      }),
      showCancelButton: false,
      onConfirmText: intl.formatMessage({
        id: ETranslations.global_got_it,
      }),
      onCancel: handleDialogDismiss,
      onClose: handleDialogDismiss,
      onConfirm: handleDialogDismiss,
    });
    throw new OneKeyLocalError('Keyless Wallet onboarding timed out');
  }, [intl, navigation]);

  const checkKeylessWalletCreatedOnServer = useCallback(
    async ({
      token,
      refreshToken,
      provider,
      realmTokenState = refreshToken
        ? 'readyForNextExchange'
        : 'refreshRequired',
      mode,
    }: {
      token: string;
      // Refresh token of a fresh OAuth session that has NOT been persisted
      // yet. When provided in verify mode, the session is persisted only
      // after the token passes local keyless wallet validation.
      refreshToken?: string;
      provider?: EOAuthSocialLoginProvider;
      realmTokenState?: IKeylessOnboardingRealmTokenState;
      mode?: EOnboardingV2OneKeyIDLoginMode;
    }) => {
      if (!token) {
        handleKeylessOnboardingTimeout();
        return;
      }
      // ResetPin or VerifyPinOnly: validate token matches local keyless wallet
      const isKeylessIdentityVerifyMode =
        mode === EOnboardingV2OneKeyIDLoginMode.KeylessResetPin ||
        mode === EOnboardingV2OneKeyIDLoginMode.KeylessVerifyPinOnly;
      // In identity-verify modes the token is cached only AFTER it passes
      // validateTokenMatchesKeylessWallet below; caching a wrong-account
      // OAuth token here would keep it alive for the whole cache TTL and
      // break a correct-account retry.
      if (!isKeylessIdentityVerifyMode) {
        await cacheKeylessOnboardingToken({
          token,
          provider,
          realmTokenState,
        });
        await cacheKeylessOnboardingPinConfirmStatusUpdated({ updated: false });
      }
      const checkLoginMatchedKeylessWallet = async () => {
        if (isKeylessIdentityVerifyMode) {
          const { isValid } =
            await backgroundApiProxy.serviceKeylessWallet.validateTokenMatchesKeylessWallet(
              { token },
            );
          if (!isValid) {
            // Drop any previously cached onboarding token (e.g. from an
            // earlier flow still within the cache TTL): the account that
            // just OAuth'd does not match the local keyless wallet, and a
            // stale token must not survive as "the onboarding token" when
            // the user retries with the correct account. Other cache
            // entries (pin, same-email status) are unrelated to this token
            // and left intact.
            clearKeylessOnboardingToken();

            // When refreshToken is provided, the mismatched session came from
            // a fresh OAuth sign-in that was never persisted, so the
            // currently persisted keyless session (which may back the active
            // OneKey ID login) must stay untouched. Without refreshToken the
            // token was read from the persisted keyless session itself, so
            // that session is wrong for this wallet: clear it completely
            // (main runtime client sign-out + bg-side shared storage), and
            // when it also backed the OneKey ID login, clear the login state
            // to avoid a zombie logged-in atom without a session.
            if (!refreshToken) {
              await backgroundApiProxy.serviceIdentityExit.reconcileInvalidKeylessSessionForLocalWallet();
            }

            // Get keyless wallet provider type to determine which dialog to show
            const keylessWallet =
              await backgroundApiProxy.serviceAccount.getKeylessWallet();
            const keylessProvider =
              keylessWallet?.keylessDetailsInfo?.keylessProvider;

            showKeylessWalletAccountMismatchError({
              intl,
              keylessProvider,
            });

            navigation.navigate(ERootRoutes.Onboarding, {
              screen: EOnboardingV2Routes.OnboardingV2,
              params: {
                screen: EOnboardingPagesV2.OneKeyIDLogin,
                params: {
                  mode,
                },
              },
            });
            throw new OneKeyLocalError(
              intl.formatMessage({
                id: ETranslations.keyless_wallet_verify_pin_account_mismatch_desc,
              }),
            );
          }
        }
      };
      await checkLoginMatchedKeylessWallet();
      if (isKeylessIdentityVerifyMode) {
        // The token matches the local keyless wallet, so it is now safe to
        // cache as the onboarding token for downstream consumers
        // (VerifyPin page, finalize/reset-pin flow).
        await cacheKeylessOnboardingToken({
          token,
          provider,
          realmTokenState,
        });
        await cacheKeylessOnboardingPinConfirmStatusUpdated({ updated: false });
        if (refreshToken) {
          // The fresh session matches the local keyless wallet, but it may
          // still belong to a DIFFERENT account than the one backing the
          // live OneKey ID login (single shared keyless session slot).
          // Detect that BEFORE persisting; on conflict the user must
          // explicitly confirm logging OneKey ID out (recoverable by
          // re-login) — the keyless wallet itself is never logged out here.
          const { hasConflict, currentOneKeyIdEmail } =
            await backgroundApiProxy.serviceKeylessWallet.getIncomingKeylessOAuthSessionConflictInfo(
              {
                incomingAccessToken: token,
              },
            );
          if (hasConflict) {
            const confirmed = await showKeylessOneKeyIdSessionConflictDialog({
              intl,
              currentOneKeyIdEmail,
            });
            if (!confirmed) {
              // Abort without persisting: the active OneKey ID session and
              // its keyless slot stay fully intact.
              throw new OneKeyLocalError({
                message: 'OneKey ID account switch cancelled by user',
                autoToast: false,
              });
            }
            const exitResult = await runIdentityExit({
              type: 'switchOneKeyIdAccount',
              scene: 'keylessOnboarding',
            });
            if (exitResult.status !== 'completed') {
              throw new OneKeyLocalError({
                message: 'OneKey ID account switch cancelled by user',
                autoToast: false,
              });
            }
          }
          // Persist the fresh OAuth session only AFTER it passed validation,
          // so a wrong-account session can never replace the active keyless
          // session. Downstream consumers (auto apiOAuthLogin below, PIN
          // confirm status checks, avatar fix) rely on the persisted session.
          await persistKeylessOAuthSession({
            accessToken: token,
            refreshToken,
          });
        }
        try {
          const isOneKeyIdLoggedIn =
            await backgroundApiProxy.servicePrime.isLoggedIn();
          if (!isOneKeyIdLoggedIn) {
            await backgroundApiProxy.servicePrime.apiOAuthLogin({
              accessToken: token,
            });
          }
        } catch (error) {
          // Best-effort login: keyless identity verification already
          // succeeded, so the wallet flow must continue even when this
          // fails. Log the reason at the source (the deduped fallback toast
          // below is skipped for user-cancel / already-auto-toasted errors)
          // and mark the error so the toast does not emit a second server
          // event for the same failure.
          logOneKeyIdLoginFailureReason(
            `Auto OneKey ID login after Keyless identity verification failed: ${getSanitizedAuthErrorText(
              error,
            )}`,
            error,
          );
          markOneKeyIdFailureServerLogged(error);
          showOneKeyIdLoginFailedToast({ error, intl });
        }
      }
      await cacheKeylessOnboardingSameEmailAccountStatus({
        status: {
          isSameEmailAccountAtOldVersion: false,
        },
      });

      if (mode === EOnboardingV2OneKeyIDLoginMode.KeylessResetPin) {
        navigation.navigate(ERootRoutes.Onboarding, {
          screen: EOnboardingV2Routes.OnboardingV2,
          params: {
            screen: EOnboardingPagesV2.CreatePin,
            params: {
              action: EKeylessFinalizeAction.ResetPin,
            },
          },
        });
        return;
      }

      if (mode === EOnboardingV2OneKeyIDLoginMode.KeylessVerifyPinOnly) {
        navigation.navigate(ERootRoutes.Onboarding, {
          screen: EOnboardingV2Routes.OnboardingV2,
          params: {
            screen: EOnboardingPagesV2.VerifyPin,
            params: {
              mode: EOnboardingV2OneKeyIDLoginMode.KeylessVerifyPinOnly,
            },
          },
        });
        return;
      }

      // Default: check wallet existence and navigate accordingly
      const isCreated =
        await backgroundApiProxy.serviceKeylessWallet.isKeylessWalletCreatedOnServer(
          {
            token,
          },
        );
      if (isCreated) {
        await cacheKeylessOnboardingSameEmailAccountStatus({
          status: {
            isSameEmailAccountAtOldVersion: false,
          },
        });
        const sameEmailAccountStatus =
          await backgroundApiProxy.serviceKeylessWallet.apiGetKeylessSameEmailAccountStatus(
            {
              token,
            },
          );
        await cacheKeylessOnboardingSameEmailAccountStatus({
          status: sameEmailAccountStatus,
        });
        navigation.navigate(ERootRoutes.Onboarding, {
          screen: EOnboardingV2Routes.OnboardingV2,
          params: {
            screen: EOnboardingPagesV2.VerifyPin,
            params: {
              mode: EOnboardingV2OneKeyIDLoginMode.KeylessCreateOrRestore,
            },
          },
        });
      } else {
        navigation.navigate(ERootRoutes.Onboarding, {
          screen: EOnboardingV2Routes.OnboardingV2,
          params: {
            screen: EOnboardingPagesV2.CreatePin,
          },
        });
      }
    },
    [
      handleKeylessOnboardingTimeout,
      intl,
      navigation,
      persistKeylessOAuthSession,
      runIdentityExit,
    ],
  );

  const showLocalKeylessWalletExistsDialog = useCallback(() => {
    Dialog.show({
      title: intl.formatMessage({
        id: ETranslations.keyless_wallet_is_enabled,
      }),
      description: intl.formatMessage({
        id: ETranslations.keyless_wallet_is_enabled_desc,
      }),
      showCancelButton: false,
      onConfirmText: intl.formatMessage({
        id: ETranslations.global_got_it,
      }),
    });
  }, [intl]);

  const continueKeylessCreateWithPreparedOneKeyId = useCallback(
    async ({
      prepareResult,
      provider,
    }: {
      prepareResult: IKeylessCreateWithOneKeyIdPrepareResult;
      provider: EOAuthSocialLoginProvider;
    }) => {
      const { token, status } = prepareResult;
      if (!token) {
        handleKeylessOnboardingTimeout();
        return;
      }

      await cacheKeylessOnboardingToken({
        token,
        provider,
        realmTokenState: 'refreshRequired',
      });
      await cacheKeylessOnboardingPinConfirmStatusUpdated({ updated: false });
      await cacheKeylessOnboardingSameEmailAccountStatus({
        status: {
          isSameEmailAccountAtOldVersion: false,
        },
      });

      if (status === EKeylessCreateWithOneKeyIdPrepareStatus.ContinueRestore) {
        const sameEmailAccountStatus =
          await backgroundApiProxy.serviceKeylessWallet.apiGetKeylessSameEmailAccountStatus(
            {
              token,
            },
          );
        await cacheKeylessOnboardingSameEmailAccountStatus({
          status: sameEmailAccountStatus,
        });
        navigation.navigate(ERootRoutes.Onboarding, {
          screen: EOnboardingV2Routes.OnboardingV2,
          params: {
            screen: EOnboardingPagesV2.VerifyPin,
            params: {
              mode: EOnboardingV2OneKeyIDLoginMode.KeylessCreateOrRestore,
            },
          },
        });
        return;
      }

      navigation.navigate(ERootRoutes.Onboarding, {
        screen: EOnboardingV2Routes.OnboardingV2,
        params: {
          screen: EOnboardingPagesV2.CreatePin,
        },
      });
    },
    [handleKeylessOnboardingTimeout, navigation],
  );

  const startKeylessCreateWithOAuthProvider = useCallback(
    async ({ provider }: { provider: EOAuthSocialLoginProvider }) => {
      const result = await signInWithSocialLogin(provider);
      const accessToken = result?.session?.accessToken;
      const refreshToken = result?.session?.refreshToken;
      if (!accessToken || !refreshToken) {
        throwLocalizedOneKeyIdLoginError({
          intl,
          reason: 'Keyless wallet OAuth login failed: session token not found',
        });
      }
      const { rollbackHandle } = await persistKeylessOAuthSession({
        accessToken,
        refreshToken,
      });
      try {
        await backgroundApiProxy.servicePrime.apiOAuthLogin({ accessToken });
      } catch (error) {
        if (shouldClearKeylessOAuthSessionAfterError(error)) {
          await backgroundApiProxy.servicePrime.rollbackProvisionalKeylessOAuthSession(
            { rollbackHandle },
          );
        }
        throw error;
      }
      await checkKeylessWalletCreatedOnServer({
        token: accessToken,
        refreshToken,
        provider,
        mode: EOnboardingV2OneKeyIDLoginMode.KeylessCreateOrRestore,
      });
    },
    [
      checkKeylessWalletCreatedOnServer,
      intl,
      persistKeylessOAuthSession,
      signInWithSocialLogin,
    ],
  );

  const reauthenticateCurrentOneKeyIdWithOAuthProvider = useCallback(
    async ({
      provider,
      promoteLegacySession,
    }: {
      provider: EOAuthSocialLoginProvider;
      promoteLegacySession: boolean;
    }) => {
      // Chrome destroys the extension action popup as soon as the OAuth
      // window takes focus. Resume from the provider-specific onboarding
      // page in the expand tab before starting the OAuth round-trip.
      if (shouldRunOneKeyIdAuthInExtExpandTab()) {
        await redirectKeylessOneKeyIdAuthToExtExpandTab({
          mode: EOnboardingV2OneKeyIDLoginMode.KeylessCreateOrRestore,
          provider,
        });
        return;
      }

      const { isLoggedIn, onekeyUserId: expectedOnekeyUserId } =
        await backgroundApiProxy.servicePrime.getLocalUserInfo();
      if (!isLoggedIn || !expectedOnekeyUserId) {
        throw new OneKeyLocalError(
          'OneKey ID OAuth reauthentication failed: OneKey ID is not logged in',
        );
      }

      let accessToken = '';
      let refreshToken = '';

      while (!accessToken) {
        // Do not persist the newly selected account until it is proven to be
        // the immutable provider identity already bound to this OneKey ID.
        const result = await signInWithSocialLogin(provider);
        const candidateAccessToken = result?.session?.accessToken || '';
        const candidateRefreshToken = result?.session?.refreshToken || '';
        if (!candidateAccessToken) {
          throwLocalizedOneKeyIdLoginError({
            intl,
            reason:
              'OneKey ID OAuth reauthentication failed: access token not found',
          });
        }

        const isMatched =
          await backgroundApiProxy.servicePrime.isOAuthIdentityBoundToCurrentOneKeyId(
            {
              oauthAccessToken: candidateAccessToken,
              provider,
            },
          );
        if (!isMatched) {
          const shouldRetry = await showOneKeyIdOAuthAccountMismatchDialog({
            intl,
            mismatchedProvider: provider,
            continueProvider: provider,
          });
          if (!shouldRetry) {
            throw new OneKeyLocalError({
              message: 'OneKey ID OAuth reauthentication cancelled by user',
              autoToast: false,
            });
          }
        } else {
          accessToken = candidateAccessToken;
          refreshToken = candidateRefreshToken;
        }
      }

      const { rollbackHandle } = await persistKeylessOAuthSession({
        accessToken,
        refreshToken,
      });
      if (promoteLegacySession) {
        try {
          // The profile + subject check above proves this provider identity is
          // already owned by the current OneKey ID. The background promotion
          // rechecks that invariant under the identity lifecycle lock before
          // switching the local auth source.
          await backgroundApiProxy.servicePrime.apiPromoteBoundOAuthSessionForLegacyOneKeyId(
            {
              accessToken,
              provider,
              expectedOnekeyUserId,
            },
          );
        } catch (error) {
          if (shouldClearKeylessOAuthSessionAfterError(error)) {
            await backgroundApiProxy.servicePrime.rollbackProvisionalKeylessOAuthSession(
              { rollbackHandle },
            );
          }
          throw error;
        }
      } else {
        // The current OneKey ID already uses the shared Keyless OAuth slot.
        // The profile check above proves this is the same bound identity, so
        // persisting the fresh session is sufficient; calling apiOAuthLogin
        // again would be rejected by the already-logged-in guard.
        const { isLoggedIn: isStillLoggedIn, onekeyUserId } =
          await backgroundApiProxy.servicePrime.getLocalUserInfo();
        if (!isStillLoggedIn || onekeyUserId !== expectedOnekeyUserId) {
          await backgroundApiProxy.servicePrime.rollbackProvisionalKeylessOAuthSession(
            { rollbackHandle },
          );
          throw new OneKeyLocalError(
            'OneKey ID login changed during OAuth reauthentication. Please try again.',
          );
        }
      }

      await checkKeylessWalletCreatedOnServer({
        token: accessToken,
        refreshToken,
        provider,
        mode: EOnboardingV2OneKeyIDLoginMode.KeylessCreateOrRestore,
      });
    },
    [
      checkKeylessWalletCreatedOnServer,
      intl,
      persistKeylessOAuthSession,
      signInWithSocialLogin,
    ],
  );

  const resolveKeylessCreateOAuthRefreshRecovery = useCallback(
    async ({
      provider,
      prepareResult: initialPrepareResult,
    }: {
      provider: EOAuthSocialLoginProvider;
      prepareResult: IKeylessCreateWithOneKeyIdPrepareResult;
    }): Promise<IKeylessCreateWithOneKeyIdPrepareResult | null> => {
      let prepareResult = initialPrepareResult;
      while (
        prepareResult.status ===
        EKeylessCreateWithOneKeyIdPrepareStatus.NeedOneKeyIdOAuthRefreshRecovery
      ) {
        const action = await showKeylessOAuthRefreshRecoveryDialog({
          intl,
          provider,
        });
        if (action === 'dismiss') {
          return null;
        }
        if (action === 'reauthenticate') {
          await reauthenticateCurrentOneKeyIdWithOAuthProvider({
            provider,
            promoteLegacySession: false,
          });
          return null;
        }
        prepareResult =
          await backgroundApiProxy.serviceKeylessWallet.continueKeylessCreateWithOneKeyId(
            { signInProvider: provider },
          );
      }
      return prepareResult;
    },
    [intl, reauthenticateCurrentOneKeyIdWithOAuthProvider],
  );

  const continueKeylessCreateWithCurrentOneKeyId = useCallback(
    async ({ provider }: { provider: EOAuthSocialLoginProvider }) => {
      const unresolvedPrepareResult =
        await backgroundApiProxy.serviceKeylessWallet.continueKeylessCreateWithOneKeyId(
          { signInProvider: provider },
        );
      const prepareResult = await resolveKeylessCreateOAuthRefreshRecovery({
        provider,
        prepareResult: unresolvedPrepareResult,
      });
      if (!prepareResult) {
        return;
      }
      if (
        prepareResult.status ===
          EKeylessCreateWithOneKeyIdPrepareStatus.ContinueCreate ||
        prepareResult.status ===
          EKeylessCreateWithOneKeyIdPrepareStatus.ContinueRestore
      ) {
        await continueKeylessCreateWithPreparedOneKeyId({
          prepareResult,
          provider,
        });
        return;
      }
      if (
        prepareResult.status ===
        EKeylessCreateWithOneKeyIdPrepareStatus.LocalKeylessExists
      ) {
        showLocalKeylessWalletExistsDialog();
        return;
      }
      if (
        prepareResult.status ===
        EKeylessCreateWithOneKeyIdPrepareStatus.LocalKeylessDataUnavailable
      ) {
        throw new OneKeyLocalError(
          prepareResult.errorMessage ||
            'Local Keyless wallet data is unavailable.',
        );
      }
      if (
        prepareResult.status ===
        EKeylessCreateWithOneKeyIdPrepareStatus.NeedOneKeyIdOAuthReauth
      ) {
        await reauthenticateCurrentOneKeyIdWithOAuthProvider({
          provider,
          promoteLegacySession: false,
        });
        return;
      }
      if (
        prepareResult.status ===
        EKeylessCreateWithOneKeyIdPrepareStatus.NeedOneKeyIdOAuthLogin
      ) {
        await startKeylessCreateWithOAuthProvider({ provider });
        return;
      }
      if (
        prepareResult.status ===
        EKeylessCreateWithOneKeyIdPrepareStatus.NeedLegacyOAuthReauth
      ) {
        await reauthenticateCurrentOneKeyIdWithOAuthProvider({
          provider,
          promoteLegacySession: true,
        });
        return;
      }
      throw new OneKeyLocalError(
        'OneKey ID sign-in state changed. Please try again.',
      );
    },
    [
      continueKeylessCreateWithPreparedOneKeyId,
      reauthenticateCurrentOneKeyIdWithOAuthProvider,
      resolveKeylessCreateOAuthRefreshRecovery,
      showLocalKeylessWalletExistsDialog,
      startKeylessCreateWithOAuthProvider,
    ],
  );

  const showContinueWithCurrentOneKeyIdDialog = useCallback(
    async ({
      provider,
      prepareResult,
    }: {
      provider: EOAuthSocialLoginProvider;
      prepareResult: IKeylessCreateWithOneKeyIdPrepareResult;
    }) =>
      new Promise<void>((resolve, reject) => {
        let isActionTriggered = false;
        let isSettled = false;
        const resolveOnce = () => {
          if (!isSettled) {
            isSettled = true;
            resolve();
          }
        };
        const rejectOnce = (error: unknown) => {
          if (!isSettled) {
            isSettled = true;
            reject(error);
          }
        };
        const displayEmail = getDisplayEmailOrUnknown({
          intl,
          displayEmail: prepareResult.displayEmail,
        });
        Dialog.show({
          title: intl.formatMessage({
            id: ETranslations.continue_with_current_onekey_id__title,
          }),
          description: intl.formatMessage(
            {
              id: ETranslations.continue_with_current_onekey_id__desc,
            },
            {
              email: displayEmail,
            },
          ),
          showCancelButton: true,
          onConfirmText: intl.formatMessage({
            id: ETranslations.global_continue,
          }),
          onCancelText: intl.formatMessage({
            id: ETranslations.global_logout,
          }),
          onConfirm: async ({ close, preventClose }) => {
            preventClose();
            // Single-fire: onCancel takes the `close` param so the dialog
            // does NOT auto-close and stays open while logout() is awaited;
            // without this guard a second Confirm/Cancel press mid-flight
            // would start a concurrent flow (double logout / OAuth popups).
            if (isActionTriggered) {
              return;
            }
            isActionTriggered = true;
            try {
              await close({ flag: 'confirm' });
              await timerUtils.wait(100);
              await continueKeylessCreateWithCurrentOneKeyId({ provider });
              resolveOnce();
            } catch (error) {
              rejectOnce(error);
            }
          },
          onCancel: (close) => {
            if (isActionTriggered) {
              return;
            }
            isActionTriggered = true;
            void (async () => {
              try {
                await close();
                await timerUtils.wait(100);
                const exitResult = await runIdentityExit({
                  type: 'switchOneKeyIdAccount',
                  scene: 'keylessOnboarding',
                });
                if (exitResult.status !== 'completed') {
                  resolveOnce();
                  return;
                }
                await startKeylessCreateWithOAuthProvider({ provider });
                resolveOnce();
              } catch (error) {
                // Ensure the dialog is not left open with the single-fire
                // guard permanently blocking both buttons (close is a no-op
                // if the dialog is already closed).
                void close();
                rejectOnce(error);
              }
            })();
          },
          onClose: () => {
            if (!isActionTriggered) {
              resolveOnce();
            }
          },
        });
      }),
    [
      continueKeylessCreateWithCurrentOneKeyId,
      intl,
      runIdentityExit,
      startKeylessCreateWithOAuthProvider,
    ],
  );

  const handleHealthyPreparedKeylessCreateWithOneKeyId = useCallback(
    async ({
      provider,
      prepareResult: initialPrepareResult,
    }: {
      provider: EOAuthSocialLoginProvider;
      prepareResult: IKeylessCreateWithOneKeyIdPrepareResult;
    }) => {
      const prepareResult = initialPrepareResult;
      if (
        prepareResult.status ===
        EKeylessCreateWithOneKeyIdPrepareStatus.LocalKeylessDataUnavailable
      ) {
        throwLocalizedOneKeyIdLoginError({
          intl,
          key: ETranslations.keyless_wallet_data_unavailable__desc,
          reason: `Keyless wallet creation preparation failed: local data unavailable. ${
            prepareResult.errorMessage || ''
          }`,
        });
      }
      if (
        prepareResult.status ===
        EKeylessCreateWithOneKeyIdPrepareStatus.LocalKeylessExists
      ) {
        showLocalKeylessWalletExistsDialog();
        return;
      }

      if (
        prepareResult.status ===
        EKeylessCreateWithOneKeyIdPrepareStatus.NeedLegacyOAuthBind
      ) {
        await showOneKeyIdLegacyOAuthBindDialog({
          type: 'required-for-keyless',
          provider,
          onBindSuccess: async () => {
            await continueKeylessCreateWithCurrentOneKeyId({ provider });
          },
        });
        return;
      }

      if (
        prepareResult.status ===
        EKeylessCreateWithOneKeyIdPrepareStatus.LegacyOAuthProviderMismatch
      ) {
        const { boundProvider } = prepareResult;
        if (!boundProvider) {
          throw new OneKeyLocalError(
            'The OAuth provider linked to the current OneKey ID is missing.',
          );
        }
        const shouldContinue = await showOneKeyIdOAuthAccountMismatchDialog({
          intl,
          mismatchedProvider: provider,
          continueProvider: boundProvider,
        });
        if (shouldContinue) {
          await reauthenticateCurrentOneKeyIdWithOAuthProvider({
            provider: boundProvider,
            promoteLegacySession: true,
          });
        }
        return;
      }

      if (
        prepareResult.status ===
        EKeylessCreateWithOneKeyIdPrepareStatus.NeedLegacyOAuthReauth
      ) {
        await reauthenticateCurrentOneKeyIdWithOAuthProvider({
          provider,
          promoteLegacySession: true,
        });
        return;
      }

      if (
        prepareResult.status ===
        EKeylessCreateWithOneKeyIdPrepareStatus.NeedOneKeyIdOAuthReauth
      ) {
        await reauthenticateCurrentOneKeyIdWithOAuthProvider({
          provider,
          promoteLegacySession: false,
        });
        return;
      }

      if (
        prepareResult.status ===
        EKeylessCreateWithOneKeyIdPrepareStatus.NeedOneKeyIdOAuthLogin
      ) {
        await startKeylessCreateWithOAuthProvider({ provider });
        return;
      }

      if (
        prepareResult.status ===
        EKeylessCreateWithOneKeyIdPrepareStatus.ConfirmCurrentOneKeyId
      ) {
        await showContinueWithCurrentOneKeyIdDialog({
          provider,
          prepareResult,
        });
        return;
      }

      if (
        prepareResult.status ===
          EKeylessCreateWithOneKeyIdPrepareStatus.ContinueCreate ||
        prepareResult.status ===
          EKeylessCreateWithOneKeyIdPrepareStatus.ContinueRestore
      ) {
        await continueKeylessCreateWithPreparedOneKeyId({
          prepareResult,
          provider,
        });
        return;
      }

      throw new OneKeyLocalError(
        `Unsupported Keyless wallet creation preparation status: ${prepareResult.status}`,
      );
    },
    [
      continueKeylessCreateWithCurrentOneKeyId,
      continueKeylessCreateWithPreparedOneKeyId,
      intl,
      reauthenticateCurrentOneKeyIdWithOAuthProvider,
      showContinueWithCurrentOneKeyIdDialog,
      showLocalKeylessWalletExistsDialog,
      startKeylessCreateWithOAuthProvider,
    ],
  );

  const handlePreparedKeylessCreateWithOneKeyId = useCallback(
    async ({
      provider,
      prepareResult,
    }: {
      provider: EOAuthSocialLoginProvider;
      prepareResult: IKeylessCreateWithOneKeyIdPrepareResult;
    }) => {
      if (
        prepareResult.status !==
        EKeylessCreateWithOneKeyIdPrepareStatus.LocalKeylessDataUnavailable
      ) {
        await handleHealthyPreparedKeylessCreateWithOneKeyId({
          provider,
          prepareResult,
        });
        return;
      }
      if (!prepareResult.walletId) {
        throwLocalizedOneKeyIdLoginError({
          intl,
          key: ETranslations.keyless_wallet_data_unavailable__desc,
          reason: `Unable to identify the local Keyless wallet for recovery. ${
            prepareResult.errorMessage || ''
          }`,
        });
      }
      await runIdentityExit(
        {
          type: 'recoverMalformedKeyless',
          expectedWalletId: prepareResult.walletId,
          nextProvider: provider,
          scene: 'keylessOnboarding',
        },
        {
          confirmButtonTestID: 'keyless-onboarding-recover-wallet-confirm-btn',
          onCompletedReceipt: async () => {
            const nextPrepareResult =
              await backgroundApiProxy.serviceKeylessWallet.prepareKeylessCreateWithOneKeyId(
                { signInProvider: provider },
              );
            await handleHealthyPreparedKeylessCreateWithOneKeyId({
              provider,
              prepareResult: nextPrepareResult,
            });
          },
        },
      );
    },
    [handleHealthyPreparedKeylessCreateWithOneKeyId, intl, runIdentityExit],
  );

  const navigateToKeylessOAuthLogin = useCallback(
    async ({
      mode,
      provider,
    }: {
      mode: EOnboardingV2OneKeyIDLoginMode;
      provider?: EOAuthSocialLoginProvider;
    }) => {
      // The OneKey ID login onboarding page runs launchWebAuthFlow, which
      // can never complete in the ext action popup (Chrome destroys it on
      // focus loss). Open the page in the expand tab instead of navigating
      // inside the popup.
      if (shouldRunOneKeyIdAuthInExtExpandTab()) {
        await redirectKeylessOneKeyIdAuthToExtExpandTab({
          mode,
          provider,
        });
        return;
      }

      navigation.navigate(ERootRoutes.Onboarding, {
        screen: EOnboardingV2Routes.OnboardingV2,
        params: {
          screen: EOnboardingPagesV2.OneKeyIDLogin,
          params: {
            mode,
            provider,
          },
        },
      });
    },
    [navigation],
  );

  // goToOneKeyIDLoginPageForKeylessWallet
  const goToOneKeyIDLoginPageForKeylessWallet = useCallback(
    async ({ mode }: { mode: EOnboardingV2OneKeyIDLoginMode }) => {
      let keylessProvider: EOAuthSocialLoginProvider | undefined;

      if (
        mode === EOnboardingV2OneKeyIDLoginMode.KeylessResetPin ||
        mode === EOnboardingV2OneKeyIDLoginMode.KeylessVerifyPinOnly
      ) {
        let keylessWallet;
        try {
          keylessWallet =
            await backgroundApiProxy.serviceAccount.getKeylessWallet();
        } catch (error) {
          logOneKeyIdLoginFailureReason(
            `Keyless OAuth navigation local wallet read failed: ${getSanitizedAuthErrorText(
              error,
            )}`,
            error,
          );
          // Continue to OAuth navigation when the local wallet cannot be read.
        }
        keylessProvider = keylessWallet?.keylessDetailsInfo?.keylessProvider;

        if (keylessWallet) {
          try {
            const accessToken =
              await backgroundApiProxy.serviceKeylessWallet.getOrMigrateKeylessOAuthAccessTokenForLocalWallet();
            if (accessToken) {
              await checkKeylessWalletCreatedOnServer({
                token: accessToken,
                provider: keylessProvider,
                realmTokenState: 'refreshRequired',
                mode,
              });
              return;
            }
          } catch (error) {
            logOneKeyIdLoginFailureReason(
              `Keyless OAuth navigation local session reuse failed: ${getSanitizedAuthErrorText(
                error,
              )}`,
              error,
            );
            // A missing or unusable session falls through to real OAuth.
          }
        }
      }

      await navigateToKeylessOAuthLogin({
        mode,
        provider: keylessProvider,
      });
    },
    [checkKeylessWalletCreatedOnServer, navigateToKeylessOAuthLogin],
  );

  const getKeylessOnboardingTokenForRealmExchange = useCallback(
    async ({
      mode,
      validateLocalWallet,
    }: {
      mode: EOnboardingV2OneKeyIDLoginMode;
      validateLocalWallet: boolean;
    }): Promise<string | null> => {
      const token = await getKeylessOnboardingToken();
      if (!token) {
        handleKeylessOnboardingTimeout();
        return null;
      }
      const provider = await getKeylessOnboardingProvider();
      const realmTokenState = await getKeylessOnboardingRealmTokenState();
      if (realmTokenState === 'readyForNextExchange') {
        await cacheKeylessOnboardingToken({
          token,
          provider,
          realmTokenState: 'refreshRequired',
        });
        return token;
      }

      const reauthenticate = async () => {
        if (
          mode === EOnboardingV2OneKeyIDLoginMode.KeylessCreateOrRestore &&
          provider
        ) {
          const { isLoggedIn } =
            await backgroundApiProxy.servicePrime.getLocalUserInfo();
          if (isLoggedIn) {
            await reauthenticateCurrentOneKeyIdWithOAuthProvider({
              provider,
              promoteLegacySession: false,
            });
            return;
          }
        }
        await navigateToKeylessOAuthLogin({ mode, provider });
      };

      while (true) {
        const refreshResult =
          await backgroundApiProxy.serviceKeylessWallet.getFreshKeylessOAuthAccessTokenForRealmExchange(
            validateLocalWallet
              ? { validateLocalWallet: true }
              : {
                  previousAccessToken: token,
                  validateLocalWallet: false,
                },
          );
        if (
          refreshResult.status === EKeylessOAuthAccessTokenRefreshStatus.Ready
        ) {
          await cacheKeylessOnboardingToken({
            token: refreshResult.accessToken,
            provider,
            // Mark it consumed before the caller starts its realm operation.
            // Any retry or later operation must rotate the access token again.
            realmTokenState: 'refreshRequired',
          });
          return refreshResult.accessToken;
        }
        if (
          refreshResult.status ===
          EKeylessOAuthAccessTokenRefreshStatus.NeedOAuthReauth
        ) {
          await reauthenticate();
          return null;
        }

        const action = await showKeylessOAuthRefreshRecoveryDialog({
          intl,
          provider,
        });
        if (action === 'dismiss') {
          return null;
        }
        if (action === 'reauthenticate') {
          await reauthenticate();
          return null;
        }
      }
    },
    [
      handleKeylessOnboardingTimeout,
      intl,
      navigateToKeylessOAuthLogin,
      reauthenticateCurrentOneKeyIdWithOAuthProvider,
    ],
  );

  const checkKeylessOnboardingRateLimitStatus = useCallback(
    async ({ mode }: { mode?: EOnboardingV2OneKeyIDLoginMode }) => {
      const realmAccessToken = await getKeylessOnboardingTokenForRealmExchange({
        mode: mode ?? EOnboardingV2OneKeyIDLoginMode.KeylessCreateOrRestore,
        validateLocalWallet:
          mode === EOnboardingV2OneKeyIDLoginMode.KeylessVerifyPinOnly,
      });
      if (!realmAccessToken) {
        return null;
      }
      return backgroundApiProxy.serviceKeylessWallet.apiCheckRateLimitStatus({
        token: realmAccessToken,
      });
    },
    [getKeylessOnboardingTokenForRealmExchange],
  );

  // Renamed function, checks if KeylessWallet exists locally
  const checkKeylessWalletLocalExistence = useCallback(
    async ({
      signInProvider,
    }: {
      signInProvider?: EOAuthSocialLoginProvider;
    } = {}) => {
      if (enableKeylessWalletLoadingRef.current) {
        return;
      }
      await errorToastUtils.withErrorAutoToast(async () => {
        try {
          enableKeylessWalletLoadingRef.current = true;
          setEnableKeylessWalletLoading(true);

          if (signInProvider) {
            const prepareResult =
              await backgroundApiProxy.serviceKeylessWallet.prepareKeylessCreateWithOneKeyId(
                { signInProvider },
              );
            await handlePreparedKeylessCreateWithOneKeyId({
              provider: signInProvider,
              prepareResult,
            });
            return;
          }
          const inspection =
            await backgroundApiProxy.serviceKeylessWallet.inspectLocalKeylessWalletForOAuth();
          if (inspection.status === ELocalKeylessWalletOAuthState.Ready) {
            showLocalKeylessWalletExistsDialog();
            return;
          }
          await goToOneKeyIDLoginPageForKeylessWallet({
            mode: EOnboardingV2OneKeyIDLoginMode.KeylessCreateOrRestore,
          });
        } finally {
          setEnableKeylessWalletLoading(false);
        }
      });
    },
    [
      goToOneKeyIDLoginPageForKeylessWallet,
      handlePreparedKeylessCreateWithOneKeyId,
      showLocalKeylessWalletExistsDialog,
    ],
  );

  const finalizeKeylessWalletV2 = useCallback(
    async ({ action }: { action?: EKeylessFinalizeAction }) => {
      const token = await getKeylessOnboardingToken();
      if (!token) {
        handleKeylessOnboardingTimeout();
        return;
      }
      const pin = await getKeylessOnboardingPin();
      if (!pin) {
        handleKeylessOnboardingTimeout();
        return;
      }
      if (!action) {
        defaultLogger.prime.subscription.onekeyIdLoginFailedReason({
          reason: 'Keyless wallet finalization failed: action is missing',
        });
        Dialog.show({
          title: intl.formatMessage({
            id: ETranslations.global_unknown_error,
          }),
          description: intl.formatMessage({
            id: ETranslations.global_unknown_error_retry_message,
          }),
          showCancelButton: false,
          onConfirmText: intl.formatMessage({
            id: ETranslations.global_got_it,
          }),
        });
        return;
      }

      const realmAccessToken = await getKeylessOnboardingTokenForRealmExchange({
        mode:
          action === EKeylessFinalizeAction.ResetPin
            ? EOnboardingV2OneKeyIDLoginMode.KeylessResetPin
            : EOnboardingV2OneKeyIDLoginMode.KeylessCreateOrRestore,
        validateLocalWallet: action === EKeylessFinalizeAction.ResetPin,
      });
      if (!realmAccessToken) {
        return;
      }

      // Handle ResetPin action
      if (action === EKeylessFinalizeAction.ResetPin) {
        await backgroundApiProxy.serviceKeylessWallet.resetKeylessWalletPin({
          token: realmAccessToken,
          newPin: pin,
        });
        navigation.navigate(ERootRoutes.Onboarding, {
          screen: EOnboardingV2Routes.OnboardingV2,
          params: {
            screen: EOnboardingPagesV2.NewPinCreated,
          },
        });
        return;
      }

      let mnemonic = '';
      let ownerId = '';
      let keylessDetailsInfo;
      let loadingDialog: IDialogInstance | undefined;
      try {
        loadingDialog = Dialog.loading({
          title: intl.formatMessage({
            id: ETranslations.global_preparing,
          }),
        });
        await timerUtils.wait(600);
        if (action === EKeylessFinalizeAction.Create) {
          const result =
            await backgroundApiProxy.serviceKeylessWallet.createKeylessWalletToServer(
              {
                token: realmAccessToken,
                pin,
                customMnemonic: await getKeylessOnboardingCustomMnemonic(),
              },
            );
          mnemonic = result.mnemonic;
          ownerId = result.ownerId;
          keylessDetailsInfo = result.keylessDetailsInfo;
        }
        if (action === EKeylessFinalizeAction.Restore) {
          const pinConfirmStatusAlreadyUpdated =
            await getKeylessOnboardingPinConfirmStatusUpdated();
          const result =
            await backgroundApiProxy.serviceKeylessWallet.restoreKeylessWalletFromServer(
              {
                token: realmAccessToken,
                pin,
                pinConfirmStatusAlreadyUpdated,
              },
            );
          mnemonic = result.mnemonic;
          ownerId = result.ownerId;
          keylessDetailsInfo = result.keylessDetailsInfo;
        }
      } finally {
        // Wait for current page animations (e.g. HeightTransition in
        // VerifyPin) to settle before navigating. The delay runs while
        // the loading dialog is still visible so the user sees no gap.
        // React Navigation's default Android transition is ~300ms;
        // matching it prevents worklet serialization collisions that
        // cause SIGSEGV on Android with Fabric/New Architecture.
        await timerUtils.wait(300);
        await loadingDialog?.close?.();
      }
      navigation.navigate(ERootRoutes.Onboarding, {
        screen: EOnboardingV2Routes.OnboardingV2,
        params: {
          screen: EOnboardingPagesV2.FinalizeWalletSetup,
          params: {
            mnemonic,
            isWalletBackedUp: true,
            isKeylessWallet: true,
            keylessOwnerId: ownerId,
            keylessDetailsInfo,
            shouldAutoResetKeylessPinAfterRestore:
              action === EKeylessFinalizeAction.Restore
                ? (await getKeylessOnboardingSameEmailAccountStatus())
                    .isSameEmailAccountAtOldVersion
                : false,
          },
        },
      });
    },
    [
      getKeylessOnboardingTokenForRealmExchange,
      handleKeylessOnboardingTimeout,
      intl,
      navigation,
    ],
  );

  const confirmKeylessOnboardingPin = useCallback(
    async ({
      pin,
      action,
    }: {
      pin: string;
      action: EKeylessFinalizeAction;
    }) => {
      await cacheKeylessOnboardingPin({ pin });
      const hasCachedPassword =
        await backgroundApiProxy.servicePassword.hasCachedPassword();
      if (hasCachedPassword) {
        await finalizeKeylessWalletV2({ action });
      } else {
        navigation.navigate(ERootRoutes.Onboarding, {
          screen: EOnboardingV2Routes.OnboardingV2,
          params: {
            screen: EOnboardingPagesV2.CreatePasscode,
            params: { action },
          },
        });
      }
    },
    [finalizeKeylessWalletV2, navigation],
  );

  const verifyKeylessOnboardingPin = useCallback(
    async ({
      pin,
      mode,
      dangerousRetryByFixedProvider,
    }: {
      pin: string;
      mode?: EOnboardingV2OneKeyIDLoginMode;
      dangerousRetryByFixedProvider: boolean;
    }) => {
      const token = await getKeylessOnboardingToken();
      if (!token) {
        handleKeylessOnboardingTimeout();
        return;
      }
      const sameEmailAccountStatus =
        mode === EOnboardingV2OneKeyIDLoginMode.KeylessCreateOrRestore
          ? await getKeylessOnboardingSameEmailAccountStatus()
          : {
              isSameEmailAccountAtOldVersion: false,
            };

      const realmAccessToken = await getKeylessOnboardingTokenForRealmExchange({
        mode: mode ?? EOnboardingV2OneKeyIDLoginMode.KeylessCreateOrRestore,
        validateLocalWallet:
          mode === EOnboardingV2OneKeyIDLoginMode.KeylessVerifyPinOnly,
      });
      if (!realmAccessToken) {
        throw new OneKeyLocalError({
          message: 'Keyless OAuth reauthentication is required.',
          autoToast: false,
        });
      }

      let pinConfirmStatusUpdated = false;
      try {
        const verifyResult =
          await backgroundApiProxy.serviceKeylessWallet.apiVerifyKeylessJuiceboxPin(
            {
              token: realmAccessToken,
              pin,
              mode,
              dangerousRetryByFixedProvider,
              providerOverride: dangerousRetryByFixedProvider
                ? undefined
                : sameEmailAccountStatus.currentProvider,
            },
          );
        pinConfirmStatusUpdated = verifyResult.pinConfirmStatusUpdated;
      } catch (error) {
        const isPinErrorByInstance = error instanceof IncorrectPinError;
        const isPinErrorByClassName = errorUtils.isErrorByClassName({
          error,
          className: EOneKeyErrorClassNames.IncorrectPinError,
        });
        const isPinError = isPinErrorByInstance || isPinErrorByClassName;

        if (
          isPinError &&
          sameEmailAccountStatus.isSameEmailAccountAtOldVersion &&
          sameEmailAccountStatus.retryProvider &&
          !dangerousRetryByFixedProvider
        ) {
          try {
            const retryVerifyResult =
              await backgroundApiProxy.serviceKeylessWallet.apiVerifyKeylessJuiceboxPin(
                {
                  token: realmAccessToken,
                  pin,
                  mode,
                  dangerousRetryByFixedProvider: false,
                  providerOverride: sameEmailAccountStatus.retryProvider,
                },
              );
            pinConfirmStatusUpdated = retryVerifyResult.pinConfirmStatusUpdated;
          } catch (retryError) {
            void syncKeylessOnboardingSameEmailRetryProviderAfterRateLimit({
              token: realmAccessToken,
              error: retryError,
              status: sameEmailAccountStatus,
            });
            throw retryError;
          }
        } else {
          throw error;
        }
      }

      // VerifyPinOnly: just verify, show success toast and close modal
      if (mode === EOnboardingV2OneKeyIDLoginMode.KeylessVerifyPinOnly) {
        navigation.popStack();
        Toast.success({
          title: intl.formatMessage({
            id: ETranslations.keyless_wallet_pin_verified_successfully,
          }),
        });
        return;
      }

      // Default: continue with restore flow
      await cacheKeylessOnboardingToken({
        token: realmAccessToken,
        provider: await getKeylessOnboardingProvider(),
        realmTokenState: 'refreshRequired',
      });
      await cacheKeylessOnboardingPinConfirmStatusUpdated({
        updated: pinConfirmStatusUpdated,
      });
      await confirmKeylessOnboardingPin({
        pin,
        action: EKeylessFinalizeAction.Restore,
      });
    },
    [
      confirmKeylessOnboardingPin,
      getKeylessOnboardingTokenForRealmExchange,
      handleKeylessOnboardingTimeout,
      intl,
      navigation,
    ],
  );

  return {
    enableKeylessWalletLoading,
    goToOneKeyIDLoginPageForKeylessWallet,
    checkKeylessWalletLocalExistence, // step1
    checkKeylessWalletCreatedOnServer, // step2 (handles all modes: default, ResetPin, VerifyPinOnly)
    confirmKeylessOnboardingPin, // step3
    verifyKeylessOnboardingPin,
    checkKeylessOnboardingRateLimitStatus,
    finalizeKeylessWalletV2, // step4
    keylessOnboardingCache,
    cacheKeylessOnboardingPin,
    getKeylessOnboardingPin,
    getKeylessOnboardingToken,
    handleKeylessOnboardingTimeout,
    cacheKeylessOnboardingCustomMnemonic,
    getKeylessOnboardingCustomMnemonic,
  };
}

let isPinReminderDialogShowing = false;

export function useVerifyKeylessPinChecking() {
  const { goToOneKeyIDLoginPageForKeylessWallet } = useKeylessWallet();
  const intl = useIntl();
  const [keylessPinConfirmStatus] = useKeylessPinConfirmStatusAtom();
  const [keylessLastCancelVerifyPinTime, setKeylessLastCancelVerifyPinTime] =
    useKeylessLastCancelVerifyPinTimeAtom();
  const [devSettings] = useDevSettingsPersistAtom();

  const cancelVerifyPin = useCallback(
    async (ownerId: string | 'CURRENT_KEYLESS_WALLET') => {
      await backgroundApiProxy.serviceKeylessWallet.cancelVerifyPin({
        ownerId,
      });

      // save last cancel verify pin time
      setKeylessLastCancelVerifyPinTime(Date.now());
    },
    [setKeylessLastCancelVerifyPinTime],
  );

  const verifyKeylessPinChecking = useCallback(
    async (options: { forceVerify?: boolean; wallet: IDBWallet }) => {
      if (isPinReminderDialogShowing) {
        return;
      }

      const getCurrentActiveWallet = async () => {
        try {
          const selectedAccount =
            await backgroundApiProxy.simpleDb.accountSelector.getSelectedAccount(
              {
                sceneName: EAccountSelectorSceneName.home,
                num: 0,
              },
            );
          if (!selectedAccount?.walletId) {
            return undefined;
          }
          return await backgroundApiProxy.serviceAccount.getWallet({
            walletId: selectedAccount.walletId,
          });
        } catch (error) {
          logOneKeyIdLoginFailureReason(
            `Keyless PIN reminder active wallet read failed: ${getSanitizedAuthErrorText(
              error,
            )}`,
            error,
          );
          return undefined;
        }
      };

      const activeWallet = options.wallet || (await getCurrentActiveWallet());
      if (activeWallet?.isKeyless) {
        const ownerId = activeWallet?.keylessDetailsInfo?.keylessOwnerId;
        if (!ownerId) {
          return;
        }

        // skip if last cancel verify pin time is less than 12 hour (skip in dev mode)
        if (!devSettings.enabled) {
          const TWELVE_HOURS_IN_MS = timerUtils.getTimeDurationMs({ hour: 12 });
          if (
            keylessLastCancelVerifyPinTime &&
            Date.now() - keylessLastCancelVerifyPinTime < TWELVE_HOURS_IN_MS &&
            !options.forceVerify
          ) {
            return;
          }
        }

        let shouldChecking = true;
        if (
          keylessPinConfirmStatus?.socialProvider ===
            activeWallet?.keylessDetailsInfo?.keylessProvider &&
          keylessPinConfirmStatus?.socialUserIdHash ===
            activeWallet?.keylessDetailsInfo?.socialUserIdHash &&
          keylessPinConfirmStatus?.remindTime &&
          keylessPinConfirmStatus?.remindTime > Date.now()
        ) {
          shouldChecking = false;
        }
        if (!shouldChecking && !options.forceVerify) {
          return;
        }
        const checkShouldVerifyPin = async () => {
          const accessToken =
            await backgroundApiProxy.serviceKeylessWallet.getActiveKeylessOAuthAccessTokenForLocalWallet();
          let shouldVerifyPin = false;
          if (accessToken) {
            void backgroundApiProxy.serviceKeylessWallet.fixKeylessWalletAvatar(
              {
                wallet: activeWallet,
                accessToken,
              },
            );
          }
          if (accessToken) {
            const { shouldRemind } =
              await backgroundApiProxy.serviceKeylessWallet.apiGetPinConfirmStatus(
                {
                  token: accessToken,
                },
              );
            shouldVerifyPin = shouldRemind;
          } else {
            shouldVerifyPin = true;
          }

          if (options.forceVerify) {
            return true;
          }
          return shouldVerifyPin;
        };
        const shouldVerifyPin = await checkShouldVerifyPin();

        if (shouldVerifyPin) {
          // Check if the current route is still the Home tab before showing the dialog
          const isHomeTabFocused = () => {
            const state = rootNavigationRef.current?.getRootState();
            if (!state || state.routes.length > 1) {
              // There are modals or other routes on top
              return false;
            }
            const mainRoute = state.routes[0];
            const mainState = mainRoute?.state;
            // Check if the current tab is Home
            const currentTabRoute = mainState?.routes?.[mainState?.index ?? 0];
            return currentTabRoute?.name === ETabRoutes.Home;
          };

          if (!isHomeTabFocused()) {
            return;
          }

          const showPinReminderDialog = () => {
            isPinReminderDialogShowing = true;
            Dialog.show({
              showExitButton: false,
              disableDrag: true,
              dismissOnOverlayPress: false,
              icon: 'InputOutline',
              tone: 'success',
              title: intl.formatMessage({
                id: ETranslations.pin_verify_reminder_dialog_title,
              }),
              renderContent: (
                <YStack gap="$3">
                  <SizableText size="$bodyLg">
                    {intl.formatMessage(
                      {
                        id: ETranslations.pin_verify_reminder_dialog_desc,
                      },
                      {
                        em: (chunks: React.ReactNode) => (
                          <SizableText size="$bodyLgMedium">
                            {chunks}
                          </SizableText>
                        ),
                      },
                    )}
                  </SizableText>
                  <SizableText size="$bodySm" color="$textSubdued">
                    {intl.formatMessage({
                      id: ETranslations.pin_reminder_email_tip,
                    })}
                  </SizableText>
                </YStack>
              ),
              showCancelButton: true,
              onCancelText: intl.formatMessage({
                id: ETranslations.global_later,
              }),
              onClose: () => {
                isPinReminderDialogShowing = false;
              },
              onCancel: async () => {
                isPinReminderDialogShowing = false;
                try {
                  await cancelVerifyPin(ownerId);
                } catch (error) {
                  // Continue to navigation if cancel fails
                  if (
                    errorUtils.isErrorByClassName({
                      error,
                      className: [
                        EOneKeyErrorClassNames.PasswordPromptDialogCancel,
                      ],
                    })
                  ) {
                    showPinReminderDialog();
                  } else {
                    logOneKeyIdLoginFailureReason(
                      `Keyless PIN reminder cancellation sync failed: ${getSanitizedAuthErrorText(
                        error,
                      )}`,
                      error,
                    );
                  }
                }
              },
              onConfirmText: intl.formatMessage({
                id: ETranslations.global_continue,
              }),
              onConfirm: async ({ close }) => {
                // Close PIN reminder dialog first
                isPinReminderDialogShowing = false;
                await close();

                try {
                  // Verify password (returns immediately if cached, otherwise shows dialog)
                  await backgroundApiProxy.servicePassword.promptPasswordVerify();

                  // Password verified - show loading dialog
                  isPinReminderDialogShowing = true;
                  const loadingDialog = Dialog.loading({
                    title: intl.formatMessage({
                      id: ETranslations.global_preparing,
                    }),
                  });

                  try {
                    const shouldVerifyPin0 = await checkShouldVerifyPin();
                    if (!shouldVerifyPin0) {
                      Toast.success({
                        title: intl.formatMessage({
                          id: ETranslations.pin_verify_reminder_dialog_verified_toast,
                        }),
                      });
                      isPinReminderDialogShowing = false;
                      await loadingDialog.close();
                      return;
                    }

                    const isHealthy =
                      await backgroundApiProxy.serviceKeylessWallet.apiCheckAuthServerStatus();
                    if (!isHealthy) {
                      Toast.error({
                        title: intl.formatMessage({
                          id: ETranslations.auth_server_error_text,
                        }),
                      });
                      isPinReminderDialogShowing = false;
                      await loadingDialog.close();
                      return;
                    }

                    // Navigate first (includes async prep work), then close loading dialog
                    await goToOneKeyIDLoginPageForKeylessWallet({
                      mode: EOnboardingV2OneKeyIDLoginMode.KeylessVerifyPinOnly,
                    });

                    isPinReminderDialogShowing = false;
                    await loadingDialog.close();
                  } catch (innerError) {
                    isPinReminderDialogShowing = false;
                    logOneKeyIdLoginFailureReason(
                      `Keyless PIN reminder continuation failed: ${getSanitizedAuthErrorText(
                        innerError,
                      )}`,
                      innerError,
                    );
                    errorToastUtils.toastIfError(innerError);
                  } finally {
                    await loadingDialog.close();
                  }
                } catch (error) {
                  // Password dialog cancelled - reshow original PIN reminder
                  if (
                    errorUtils.isErrorByClassName({
                      error,
                      className: [
                        EOneKeyErrorClassNames.PasswordPromptDialogCancel,
                      ],
                    })
                  ) {
                    showPinReminderDialog();
                  } else {
                    logOneKeyIdLoginFailureReason(
                      `Keyless PIN reminder password flow failed: ${getSanitizedAuthErrorText(
                        error,
                      )}`,
                      error,
                    );
                  }
                }
              },
            });
          };

          showPinReminderDialog();
        }
      }
    },
    [
      cancelVerifyPin,
      devSettings.enabled,
      goToOneKeyIDLoginPageForKeylessWallet,
      intl,
      keylessLastCancelVerifyPinTime,
      keylessPinConfirmStatus?.remindTime,
      keylessPinConfirmStatus?.socialProvider,
      keylessPinConfirmStatus?.socialUserIdHash,
    ],
  );
  return { verifyKeylessPinChecking, cancelVerifyPin };
}
