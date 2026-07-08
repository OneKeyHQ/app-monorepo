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
import type { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';
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
  type IKeylessCreateWithOneKeyIdPrepareResult,
} from '@onekeyhq/shared/src/keylessWallet/keylessWalletTypes';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ERootRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';
import {
  EOnboardingPagesV2,
  EOnboardingV2OneKeyIDLoginMode,
  EOnboardingV2Routes,
} from '@onekeyhq/shared/src/routes/onboardingv2';
import cacheUtils from '@onekeyhq/shared/src/utils/cacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { isTransientNetworkLikeError } from '@onekeyhq/shared/src/utils/transientNetworkErrorUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../hooks/useAppNavigation';
import { usePromiseResult } from '../../hooks/usePromiseResult';
import { showOneKeyIdLegacyOAuthBindDialog } from '../../views/Prime/components/OneKeyIdLegacyOAuthBind/OneKeyIdLegacyOAuthBind';
import { getDisplayEmailOrUnknown } from '../OneKeyAuth/oneKeyIdDisplayEmailUtils';
import { useOneKeyAuth } from '../OneKeyAuth/useOneKeyAuth';

import {
  showKeylessOneKeyIdSessionConflictDialog,
  showKeylessWalletAccountMismatchError,
} from './AccountMismatchDialog';
import {
  getPromotedSameEmailAccountStatusAfterAutoRetryRateLimit,
  isKeylessSameEmailAutoRetryRateLimitError,
} from './sameEmailAccountStatusUtils';

import type { IKeylessSameEmailAccountStatus } from './sameEmailAccountStatusUtils';

export function useKeylessWalletFeatureIsEnabled(): boolean {
  return true;
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

async function cacheKeylessOnboardingToken({ token }: { token: string }) {
  await keylessOnboardingCacheSet('socialLoginToken', token);
}

async function getKeylessOnboardingToken() {
  const token = keylessOnboardingCacheGet('socialLoginToken');
  return token;
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
  } catch {
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
  } catch {
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
    console.error(
      'Failed to sync keyless same-email retry provider after rate limit:',
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
  const {
    signInWithSocialLogin,
    logout,
    keylessSupabaseSignOut,
    persistKeylessOAuthSession,
  } = useOneKeyAuth();
  const navigation = useAppNavigation();
  const intl = useIntl();

  const [enableKeylessWalletLoading, setEnableKeylessWalletLoading] =
    useState(false);
  const enableKeylessWalletLoadingRef = useRef(enableKeylessWalletLoading);
  enableKeylessWalletLoadingRef.current = enableKeylessWalletLoading;

  const handleKeylessOnboardingTimeout = useCallback(() => {
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
      onCancel: () => {
        keylessOnboardingCache.clear();
        navigation.popStack();
      },
      onClose: () => {
        keylessOnboardingCache.clear();
        navigation.popStack();
      },
      onConfirm: () => {
        keylessOnboardingCache.clear();
        navigation.popStack();
      },
    });
    throw new OneKeyLocalError('Keyless Wallet onboarding timed out');
  }, [intl, navigation]);

  const checkKeylessWalletCreatedOnServer = useCallback(
    async ({
      token,
      refreshToken,
      mode,
    }: {
      token: string;
      // Refresh token of a fresh OAuth session that has NOT been persisted
      // yet. When provided in verify mode, the session is persisted only
      // after the token passes local keyless wallet validation.
      refreshToken?: string;
      mode?: EOnboardingV2OneKeyIDLoginMode;
    }) => {
      if (!token) {
        handleKeylessOnboardingTimeout();
        return;
      }
      await cacheKeylessOnboardingToken({ token });
      await cacheKeylessOnboardingPinConfirmStatusUpdated({ updated: false });

      // ResetPin or VerifyPinOnly: validate token matches local keyless wallet
      const isKeylessIdentityVerifyMode =
        mode === EOnboardingV2OneKeyIDLoginMode.KeylessResetPin ||
        mode === EOnboardingV2OneKeyIDLoginMode.KeylessVerifyPinOnly;
      const checkLoginMatchedKeylessWallet = async () => {
        if (isKeylessIdentityVerifyMode) {
          const { isValid } =
            await backgroundApiProxy.serviceKeylessWallet.validateTokenMatchesKeylessWallet(
              { token },
            );
          if (!isValid) {
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
              await keylessSupabaseSignOut();
              await backgroundApiProxy.serviceKeylessWallet.clearKeylessAuthSessionAndLoginState();
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
            // Log out OneKey ID while preserving the keyless wallet and its
            // local auth artifacts (bg resets the Prime persist atom + auth
            // session source; the atom change syncs to the main runtime).
            await logout({ preserveLocalKeylessAuth: true });
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
          console.error(
            'Failed to auto login OneKey ID after Keyless identity verification:',
            error,
          );
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
      keylessSupabaseSignOut,
      logout,
      navigation,
      persistKeylessOAuthSession,
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
    }: {
      prepareResult: IKeylessCreateWithOneKeyIdPrepareResult;
    }) => {
      const { token, status } = prepareResult;
      if (!token) {
        handleKeylessOnboardingTimeout();
        return;
      }

      await cacheKeylessOnboardingToken({ token });
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
      const result = await signInWithSocialLogin(provider, {
        persistSession: true,
      });
      const accessToken = result?.session?.accessToken;
      if (!accessToken) {
        throw new OneKeyLocalError(
          'Keyless wallet OAuth login failed: access token not found',
        );
      }
      try {
        await backgroundApiProxy.servicePrime.apiOAuthLogin({ accessToken });
      } catch (error) {
        // Only a definite auth/business rejection of the OneKey ID login
        // (e.g. invalid token 90002/90003, OAuth identity already bound)
        // invalidates the keyless OAuth session persisted just above, so
        // only then wipe it before rethrowing. A transient failure (network
        // down, 5xx, timeout) must NOT destroy that session: downstream
        // keyless server calls authenticate with the Supabase access token
        // directly and don't depend on the Prime login, and keeping the
        // session lets the next attempt reuse it instead of forcing a fresh
        // Google/Apple OAuth round-trip.
        if (!isTransientNetworkLikeError(error)) {
          await logout();
          await backgroundApiProxy.simpleDb.prime.clearLocalAuthSession();
        }
        throw error;
      }
      await checkKeylessWalletCreatedOnServer({
        token: accessToken,
        mode: EOnboardingV2OneKeyIDLoginMode.KeylessCreateOrRestore,
      });
    },
    [checkKeylessWalletCreatedOnServer, logout, signInWithSocialLogin],
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
          title: 'Continue with current OneKey ID?',
          description: `You are signed in as ${displayEmail}. Continue with this OneKey ID to create a Keyless wallet, or sign out to use another Google or Apple account.`,
          showCancelButton: true,
          onConfirmText: intl.formatMessage({
            id: ETranslations.global_continue,
          }),
          onCancelText: intl.formatMessage({
            id: ETranslations.global_logout,
          }),
          onConfirm: async ({ close, preventClose }) => {
            preventClose();
            isActionTriggered = true;
            try {
              await close({ flag: 'confirm' });
              await timerUtils.wait(100);
              await continueKeylessCreateWithPreparedOneKeyId({
                prepareResult,
              });
              resolveOnce();
            } catch (error) {
              rejectOnce(error);
            }
          },
          onCancel: (close) => {
            isActionTriggered = true;
            void (async () => {
              try {
                await logout();
                await close();
                await timerUtils.wait(100);
                await startKeylessCreateWithOAuthProvider({ provider });
                resolveOnce();
              } catch (error) {
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
      continueKeylessCreateWithPreparedOneKeyId,
      intl,
      logout,
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
          bindProvider: provider,
          checkBindRequired: false,
          onBindSuccess: async () => {
            const nextPrepareResult =
              await backgroundApiProxy.serviceKeylessWallet.prepareKeylessCreateWithOneKeyId();
            if (
              nextPrepareResult.status ===
                EKeylessCreateWithOneKeyIdPrepareStatus.ContinueCreate ||
              nextPrepareResult.status ===
                EKeylessCreateWithOneKeyIdPrepareStatus.ContinueRestore
            ) {
              await continueKeylessCreateWithPreparedOneKeyId({
                prepareResult: nextPrepareResult,
              });
              return;
            }
            if (
              nextPrepareResult.status ===
              EKeylessCreateWithOneKeyIdPrepareStatus.LocalKeylessExists
            ) {
              showLocalKeylessWalletExistsDialog();
              return;
            }
            await startKeylessCreateWithOAuthProvider({ provider });
          },
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

      await showContinueWithCurrentOneKeyIdDialog({
        provider,
        prepareResult,
      });
    },
    [
      continueKeylessCreateWithPreparedOneKeyId,
      showContinueWithCurrentOneKeyIdDialog,
      showLocalKeylessWalletExistsDialog,
      startKeylessCreateWithOAuthProvider,
    ],
  );

  // goToOneKeyIDLoginPageForKeylessWallet
  const goToOneKeyIDLoginPageForKeylessWallet = useCallback(
    async ({ mode }: { mode: EOnboardingV2OneKeyIDLoginMode }) => {
      let keylessProvider: EOAuthSocialLoginProvider | undefined;

      if (
        mode === EOnboardingV2OneKeyIDLoginMode.KeylessResetPin ||
        mode === EOnboardingV2OneKeyIDLoginMode.KeylessVerifyPinOnly
      ) {
        // Get keyless wallet to extract ownerId and provider from keylessDetailsInfo
        let keylessWallet;
        try {
          keylessWallet =
            await backgroundApiProxy.serviceAccount.getKeylessWallet();
        } catch (_error) {
          // Continue to navigation if getKeylessWallet fails
        }
        keylessProvider = keylessWallet?.keylessDetailsInfo?.keylessProvider;

        if (keylessWallet) {
          let accessToken: string | null = null;
          try {
            accessToken =
              await backgroundApiProxy.serviceKeylessWallet.getOrMigrateKeylessOAuthAccessTokenForLocalWallet();
          } catch (_error) {
            // Continue to navigation if the shared OAuth session is unavailable.
          }

          if (accessToken) {
            await checkKeylessWalletCreatedOnServer({
              token: accessToken,
              mode,
            });
            return;
          }
        }
      }

      navigation.navigate(ERootRoutes.Onboarding, {
        screen: EOnboardingV2Routes.OnboardingV2,
        params: {
          screen: EOnboardingPagesV2.OneKeyIDLogin,
          params: {
            mode,
            provider: keylessProvider,
          },
        },
      });
    },
    [navigation, checkKeylessWalletCreatedOnServer],
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

          const exists =
            await backgroundApiProxy.serviceAccount.isKeylessWalletExistsLocal();
          if (exists) {
            showLocalKeylessWalletExistsDialog();
          } else {
            if (signInProvider) {
              const prepareResult =
                await backgroundApiProxy.serviceKeylessWallet.prepareKeylessCreateWithOneKeyId();
              await handlePreparedKeylessCreateWithOneKeyId({
                provider: signInProvider,
                prepareResult,
              });
              return;
            }
            await goToOneKeyIDLoginPageForKeylessWallet({
              mode: EOnboardingV2OneKeyIDLoginMode.KeylessCreateOrRestore,
            });
          }
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
        Dialog.show({
          title: 'Keyless Wallet',
          description: 'EKeylessFinalizeAction is required',
          showCancelButton: false,
          onConfirmText: intl.formatMessage({
            id: ETranslations.global_got_it,
          }),
        });
        return;
      }

      // Handle ResetPin action
      if (action === EKeylessFinalizeAction.ResetPin) {
        await backgroundApiProxy.serviceKeylessWallet.resetKeylessWalletPin({
          token,
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
                token,
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
                token,
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
    [navigation, handleKeylessOnboardingTimeout, intl],
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

      let pinConfirmStatusUpdated = false;
      try {
        const verifyResult =
          await backgroundApiProxy.serviceKeylessWallet.apiVerifyKeylessJuiceboxPin(
            {
              token,
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
                  token,
                  pin,
                  mode,
                  dangerousRetryByFixedProvider: false,
                  providerOverride: sameEmailAccountStatus.retryProvider,
                },
              );
            pinConfirmStatusUpdated = retryVerifyResult.pinConfirmStatusUpdated;
          } catch (retryError) {
            void syncKeylessOnboardingSameEmailRetryProviderAfterRateLimit({
              token,
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
      await cacheKeylessOnboardingToken({ token });
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
        } catch {
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
                    await loadingDialog.close();
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
