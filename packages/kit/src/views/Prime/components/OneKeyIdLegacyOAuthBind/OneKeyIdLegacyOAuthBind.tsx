import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Icon,
  SizableText,
  Stack,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import {
  redirectOneKeyIdAuthToExtExpandTab,
  shouldRunOneKeyIdAuthInExtExpandTab,
} from '@onekeyhq/kit/src/components/OneKeyAuth/extOneKeyIdAuthExpandTab';
import { getDisplayEmailOrUnknown } from '@onekeyhq/kit/src/components/OneKeyAuth/oneKeyIdDisplayEmailUtils';
import {
  EOneKeyIdLogoutDialogSource,
  useShowOneKeyIdLogoutDialog,
} from '@onekeyhq/kit/src/components/OneKeyAuth/OneKeyIdLogoutDialog';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import {
  EExtOneKeyIdAuthFlow,
  EOAuthSocialLoginProvider,
} from '@onekeyhq/shared/src/consts/authConsts';
import {
  EOneKeyErrorClassNames,
  type IOneKeyError,
} from '@onekeyhq/shared/src/errors/types/errorTypes';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import type { IOneKeyIdLoginWithLocalKeylessPrepareResult } from '@onekeyhq/shared/src/keylessWallet/keylessWalletTypes';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  getBoundOAuthProviders,
  getOAuthSocialLoginProviderName,
  getOneKeyIdOAuthProviderIcon,
  getOneKeyIdOAuthProviderName,
} from '@onekeyhq/shared/src/utils/oauthProviderUtils';
import { isLegacyOneKeyIdAccountMissingOAuthIdentity } from '@onekeyhq/shared/src/utils/oneKeyIdAccountUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { isTransientNetworkLikeError } from '@onekeyhq/shared/src/utils/transientNetworkErrorUtils';
import type { EOneKeyIdOAuthProvider } from '@onekeyhq/shared/types/prime/primeTypes';

import { showOneKeyIdLoginSuccessToast } from '../oneKeyIdLoginToastUtils';
import { useOneKeyIdLocalKeylessOAuth } from '../useOneKeyIdLocalKeylessOAuth';

import type { IntlShape } from 'react-intl';

// TODO: i18n
export const ONEKEY_ID_BIND_OAUTH_TITLE = 'Add Google or Apple Sign-In';
// TODO: i18n
export const ONEKEY_ID_BIND_OAUTH_DESC =
  'Email sign-in is legacy. Add a social sign-in method to keep access to your OneKey ID.';
let isLegacyOAuthBindDialogVisible = false;

const PREPARE_LOCAL_KEYLESS_MAX_ATTEMPTS = 3;
const PREPARE_LOCAL_KEYLESS_RETRY_DELAY_MS = 1000;

// TODO: i18n (use a {provider} placeholder)
function getBindOAuthTitle(provider?: EOAuthSocialLoginProvider) {
  return provider
    ? `Add ${getOAuthSocialLoginProviderName(provider)} Sign-In`
    : ONEKEY_ID_BIND_OAUTH_TITLE;
}

// TODO: i18n (use a {provider} placeholder)
function getBindOAuthDescription(provider?: EOAuthSocialLoginProvider) {
  return provider
    ? `Email sign-in is legacy. Add ${getOAuthSocialLoginProviderName(
        provider,
      )} sign-in to keep access to your OneKey ID.`
    : ONEKEY_ID_BIND_OAUTH_DESC;
}

function isOneKeyIdOAuthIdentityAlreadyBoundError(error: unknown): boolean {
  const err = error as IOneKeyError | undefined;
  return (
    err?.className ===
      EOneKeyErrorClassNames.OneKeyErrorOneKeyIdOAuthIdentityAlreadyBound ||
    err?.name ===
      EOneKeyErrorClassNames.OneKeyErrorOneKeyIdOAuthIdentityAlreadyBound
  );
}

/**
 * Server-side identity ownership conflict (oauth_identity_already_bound): the
 * OAuth identity belongs to a DIFFERENT OneKey ID, and server-side binding is
 * monotonic (identities are only ever added), so retrying this bind can never
 * succeed. The only in-app recovery is switching to the OneKey ID that owns
 * the identity; ask for explicit confirmation because it logs the current
 * legacy email account out (recoverable via email re-login).
 */
async function showOneKeyIdOAuthIdentityAlreadyBoundSwitchDialog({
  intl,
  provider,
  hasLocalKeylessWallet,
}: {
  intl: IntlShape;
  provider: EOAuthSocialLoginProvider;
  hasLocalKeylessWallet: boolean;
}): Promise<boolean> {
  const providerName = getOAuthSocialLoginProviderName(provider);
  let displayEmail: string | undefined;
  try {
    const userInfo = await backgroundApiProxy.servicePrime.getLocalUserInfo();
    displayEmail = userInfo?.displayEmail;
  } catch {
    // keep the localized "Unknown" fallback from getDisplayEmailOrUnknown
  }
  const emailText = getDisplayEmailOrUnknown({ intl, displayEmail });
  return new Promise<boolean>((resolve) => {
    let isSettled = false;
    const settle = (value: boolean) => {
      if (!isSettled) {
        isSettled = true;
        resolve(value);
      }
    };
    Dialog.show({
      icon: 'ErrorOutline',
      // TODO: i18n
      title: 'Already Linked to Another OneKey ID',
      // TODO: i18n (two full messages — with and without the trailing
      // Keyless clause; never concatenate translated fragments)
      description: `This ${providerName} account is already linked to another OneKey ID, so it can't be added to ${emailText}. Continuing will log out of ${emailText} and sign in with the OneKey ID linked to this ${providerName} account. You can log back in with email verification at any time${
        hasLocalKeylessWallet ? '; the Keyless wallet stays untouched' : ''
      }.`,
      showCancelButton: true,
      onConfirmText: intl.formatMessage({ id: ETranslations.global_continue }),
      onCancelText: intl.formatMessage({ id: ETranslations.global_cancel }),
      onConfirm: () => settle(true),
      onCancel: () => settle(false),
      onClose: () => settle(false),
    });
  });
}

function OneKeyIdLegacyOAuthBindHeader({
  bindProvider,
  inDialog,
}: {
  bindProvider?: EOAuthSocialLoginProvider;
  inDialog?: boolean;
}) {
  const title = getBindOAuthTitle(bindProvider);
  const description = getBindOAuthDescription(bindProvider);

  if (inDialog) {
    return (
      <Dialog.Header>
        <Dialog.Icon icon="OnekeyBrand" />
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Description>{description}</Dialog.Description>
      </Dialog.Header>
    );
  }

  return (
    <YStack gap="$1">
      <SizableText size="$bodyMdMedium" color="$text">
        {title}
      </SizableText>
      <SizableText size="$bodySm" color="$textSubdued">
        {description}
      </SizableText>
    </YStack>
  );
}

function OneKeyIdLegacyOAuthBindActions({
  bindProvider,
  buttonSize = 'small',
  fullWidth,
  onBindSuccess,
  onBindError,
  onBeforeShowNestedDialog,
}: {
  bindProvider?: EOAuthSocialLoginProvider;
  buttonSize?: 'small' | 'large';
  fullWidth?: boolean;
  onBindSuccess?: () => void | Promise<void>;
  onBindError?: (error: unknown) => void;
  // Called when the flow hands off to another dialog (keyless logout, switch
  // account): the host bind dialog should close itself and settle as
  // not-bound before the nested dialog shows.
  onBeforeShowNestedDialog?: () => void | Promise<void>;
}) {
  const intl = useIntl();
  const { legacySupabaseSignOut, logout } = useOneKeyAuth();
  const showOneKeyIdLogoutDialog = useShowOneKeyIdLogoutDialog();
  const [bindingProvider, setBindingProvider] =
    useState<EOAuthSocialLoginProvider | null>(null);
  const [showKeylessLogoutAction, setShowKeylessLogoutAction] = useState(false);
  const [localKeylessLoginPrepareResult, setLocalKeylessLoginPrepareResult] =
    useState<IOneKeyIdLoginWithLocalKeylessPrepareResult | null>(null);
  const bindingProviderRef = useRef<EOAuthSocialLoginProvider | null>(null);
  const handleAccountMismatch = useCallback(() => {
    setShowKeylessLogoutAction(true);
  }, []);
  const {
    localKeylessProvider,
    isLocalKeylessOAuthMode,
    getOAuthAccessToken,
    clearOAuthSignInTempSession,
  } = useOneKeyIdLocalKeylessOAuth({
    localKeylessLoginPrepareResult,
    onAccountMismatch: handleAccountMismatch,
    forceAccountMismatchToast: true,
  });
  const effectiveBindProvider = localKeylessProvider ?? bindProvider;

  useEffect(() => {
    let isMounted = true;
    // Never fake a NoLocalKeyless result when prepare rejects: the bg method
    // already degrades transient Supabase failures to NeedOAuthLogin, so a
    // rejection here means the bg bridge call itself failed and nothing is
    // known about the local Keyless wallet. Faking NoLocalKeyless would
    // render both provider buttons and turn the token-matches-wallet guard
    // into a no-op, allowing a wrong-account permanent bind that also
    // overwrites the shared keyless session slot. Keep the buttons disabled
    // (result stays null) and retry with backoff instead.
    const prepareLocalKeylessLogin = async () => {
      for (
        let attempt = 1;
        attempt <= PREPARE_LOCAL_KEYLESS_MAX_ATTEMPTS;
        attempt += 1
      ) {
        try {
          const result =
            await backgroundApiProxy.serviceKeylessWallet.prepareOneKeyIdLoginWithLocalKeyless();
          if (isMounted) {
            setLocalKeylessLoginPrepareResult(result);
          }
          return;
        } catch (error) {
          if (attempt >= PREPARE_LOCAL_KEYLESS_MAX_ATTEMPTS) {
            console.error(
              'OneKeyIdLegacyOAuthBindActions prepare failed:',
              error,
            );
            return;
          }
          await timerUtils.wait(PREPARE_LOCAL_KEYLESS_RETRY_DELAY_MS * attempt);
          if (!isMounted) {
            return;
          }
        }
      }
    };

    void prepareLocalKeylessLogin();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSwitchToBoundOneKeyId = useCallback(
    async ({
      provider,
      oauthAccessToken,
      didUseOAuthSignIn,
    }: {
      provider: EOAuthSocialLoginProvider;
      oauthAccessToken: string;
      didUseOAuthSignIn: boolean;
    }) => {
      const confirmed = await showOneKeyIdOAuthIdentityAlreadyBoundSwitchDialog(
        {
          intl,
          provider,
          hasLocalKeylessWallet: isLocalKeylessOAuthMode,
        },
      );
      if (!confirmed) {
        if (didUseOAuthSignIn) {
          await clearOAuthSignInTempSession();
        }
        return;
      }
      try {
        // Same switch sequence as useKeylessLocalExistenceLogin: log the
        // legacy email OneKey ID out first (recoverable via email re-login;
        // keyless auth artifacts are preserved), then log in with the OAuth
        // session that owns the conflicting identity.
        await logout({ preserveLocalKeylessAuth: true });
        await backgroundApiProxy.servicePrime.apiOAuthLogin({
          accessToken: oauthAccessToken,
        });
      } catch (error) {
        // Only tear the temp session down on definitive rejections (same
        // policy as PrimeLoginOAuthDialog): a transient failure (network
        // blip, transient session-storage read) says nothing about the
        // just-validated session, and keeping it lets a retry re-login
        // without a fresh OAuth round-trip — especially important here,
        // where the legacy account was already logged out above and clearing
        // the session would strand the user fully logged out.
        if (didUseOAuthSignIn && !isTransientNetworkLikeError(error)) {
          await clearOAuthSignInTempSession();
        }
        throw error;
      }
      showOneKeyIdLoginSuccessToast(intl);
    },
    [clearOAuthSignInTempSession, intl, isLocalKeylessOAuthMode, logout],
  );

  const handleBindOAuth = useCallback(
    async (provider: EOAuthSocialLoginProvider) => {
      if (bindingProviderRef.current) {
        return;
      }
      // launchWebAuthFlow can never complete in the ext action popup (Chrome
      // destroys it on focus loss), so hand the bind flow off to the expand
      // tab. Guarding the button press (not the mount) keeps the passive
      // upgrade prompt (PrimeGlobalEffect) from opening tabs without an
      // explicit user gesture, and also covers the inline bind prompt on the
      // OneKey ID page.
      if (shouldRunOneKeyIdAuthInExtExpandTab()) {
        await redirectOneKeyIdAuthToExtExpandTab({
          flow: EExtOneKeyIdAuthFlow.LegacyOAuthBind,
        });
        return;
      }
      bindingProviderRef.current = provider;
      setBindingProvider(provider);
      try {
        setShowKeylessLogoutAction(false);
        await errorToastUtils.withErrorAutoToast(async () => {
          let didUseOAuthSignIn = false;
          let oauthAccessToken = '';
          try {
            const result = await getOAuthAccessToken({
              provider,
              // TODO: i18n (surfaces as a raw toast via withErrorAutoToast)
              missingTokenMessage: 'OAuth bind failed: access token not found',
            });
            didUseOAuthSignIn = result.didUseOAuthSignIn;
            oauthAccessToken = result.accessToken;
            await backgroundApiProxy.servicePrime.apiBindLegacyOneKeyIdOAuth({
              oauthAccessToken,
            });
          } catch (error) {
            if (
              oauthAccessToken &&
              isOneKeyIdOAuthIdentityAlreadyBoundError(error)
            ) {
              // BackgroundApiProxyBase schedules the auto toast for this
              // bridged error in a delayed setTimeout; clearing autoToast on
              // the same object reference cancels it — the switch-account
              // dialog is the user-facing feedback for this error instead.
              // The temp OAuth session is intentionally NOT cleared here: the
              // switch flow needs it, and handleSwitchToBoundOneKeyId cleans
              // it up on cancel/failure.
              errorToastUtils.toastIfErrorDisable(error);
              await onBeforeShowNestedDialog?.();
              await timerUtils.wait(300);
              await handleSwitchToBoundOneKeyId({
                provider,
                oauthAccessToken,
                didUseOAuthSignIn,
              });
              return;
            }
            // Definitive rejections only (same policy as
            // PrimeLoginOAuthDialog): keep the just-persisted session on
            // transient failures so a retry can reuse it.
            if (didUseOAuthSignIn && !isTransientNetworkLikeError(error)) {
              await clearOAuthSignInTempSession();
            }
            throw error;
          }
          await legacySupabaseSignOut();
          await onBindSuccess?.();
          Toast.success({
            title: intl.formatMessage({ id: ETranslations.global_success }),
          });
        });
      } catch (error) {
        onBindError?.(error);
      } finally {
        bindingProviderRef.current = null;
        setBindingProvider(null);
      }
    },
    [
      clearOAuthSignInTempSession,
      getOAuthAccessToken,
      handleSwitchToBoundOneKeyId,
      intl,
      legacySupabaseSignOut,
      onBeforeShowNestedDialog,
      onBindError,
      onBindSuccess,
    ],
  );

  const handleLogoutKeylessWallet = useCallback(async () => {
    if (bindingProviderRef.current) {
      return;
    }
    const keylessWallet =
      await backgroundApiProxy.serviceAccount.getKeylessWallet();
    if (!keylessWallet) {
      return;
    }

    await onBeforeShowNestedDialog?.();
    await timerUtils.wait(300);
    void showOneKeyIdLogoutDialog({
      source: EOneKeyIdLogoutDialogSource.KeylessWallet,
      keylessWallet,
      isOneKeyIdLoggedIn: false,
    });
  }, [onBeforeShowNestedDialog, showOneKeyIdLogoutDialog]);

  const googleButton = (
    <Button
      key="google"
      size={buttonSize}
      icon="GoogleIllus"
      testID="onekey-id-bind-oauth-google-btn"
      width={fullWidth ? '100%' : undefined}
      loading={bindingProvider === EOAuthSocialLoginProvider.Google}
      disabled={Boolean(bindingProvider) || !localKeylessLoginPrepareResult}
      onPress={() => handleBindOAuth(EOAuthSocialLoginProvider.Google)}
    >
      {intl.formatMessage(
        { id: ETranslations.continue_with_social_platform },
        { platform: 'Google' },
      )}
    </Button>
  );
  const appleButton = (
    <Button
      key="apple"
      size={buttonSize}
      icon="AppleBrand"
      testID="onekey-id-bind-oauth-apple-btn"
      width={fullWidth ? '100%' : undefined}
      loading={bindingProvider === EOAuthSocialLoginProvider.Apple}
      disabled={Boolean(bindingProvider) || !localKeylessLoginPrepareResult}
      onPress={() => handleBindOAuth(EOAuthSocialLoginProvider.Apple)}
    >
      {intl.formatMessage(
        { id: ETranslations.continue_with_social_platform },
        { platform: 'Apple' },
      )}
    </Button>
  );

  let buttons = [googleButton, appleButton];
  if (effectiveBindProvider === EOAuthSocialLoginProvider.Google) {
    buttons = [googleButton];
  } else if (effectiveBindProvider === EOAuthSocialLoginProvider.Apple) {
    buttons = [appleButton];
  }

  if (fullWidth) {
    return (
      <YStack gap={buttonSize === 'large' ? '$3' : '$2'} width="100%">
        {buttons}
        {showKeylessLogoutAction && isLocalKeylessOAuthMode ? (
          <YStack gap="$2" ai="center">
            <SizableText size="$bodySm" color="$textSubdued" ta="center">
              {intl.formatMessage({
                id: ETranslations.keyless_wallet_verify_pin_account_mismatch_desc,
              })}
            </SizableText>
            <Button
              size="small"
              variant="secondary"
              icon="LogoutOutline"
              testID="onekey-id-bind-oauth-logout-keyless-wallet-btn"
              disabled={Boolean(bindingProvider)}
              onPress={handleLogoutKeylessWallet}
            >
              {intl.formatMessage({
                id: ETranslations.log_out_wallet,
              })}
            </Button>
          </YStack>
        ) : null}
      </YStack>
    );
  }

  return (
    <YStack gap="$2">
      <XStack gap="$2" flexWrap="wrap">
        {buttons}
      </XStack>
      {showKeylessLogoutAction && isLocalKeylessOAuthMode ? (
        <YStack gap="$2" ai="flex-start">
          <SizableText size="$bodySm" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.keyless_wallet_verify_pin_account_mismatch_desc,
            })}
          </SizableText>
          <Button
            size="small"
            variant="secondary"
            icon="LogoutOutline"
            testID="onekey-id-bind-oauth-logout-keyless-wallet-btn"
            disabled={Boolean(bindingProvider)}
            onPress={handleLogoutKeylessWallet}
          >
            {intl.formatMessage({
              id: ETranslations.log_out_wallet,
            })}
          </Button>
        </YStack>
      ) : null}
    </YStack>
  );
}

function OneKeyIdLegacyOAuthBindDialogContent({
  bindProvider,
  onBindSuccess,
  onBindError,
  onBeforeShowNestedDialog,
}: {
  bindProvider?: EOAuthSocialLoginProvider;
  onBindSuccess?: () => void | Promise<void>;
  onBindError?: (error: unknown) => void;
  onBeforeShowNestedDialog?: () => void | Promise<void>;
}) {
  return (
    <Stack>
      <OneKeyIdLegacyOAuthBindHeader bindProvider={bindProvider} inDialog />
      <OneKeyIdLegacyOAuthBindActions
        bindProvider={bindProvider}
        buttonSize="large"
        fullWidth
        onBindSuccess={onBindSuccess}
        onBindError={onBindError}
        onBeforeShowNestedDialog={onBeforeShowNestedDialog}
      />
      <Dialog.Footer showFooter={false} />
    </Stack>
  );
}

function OneKeyIdOAuthBindStatus({
  providers,
}: {
  providers: EOneKeyIdOAuthProvider[];
}) {
  const providerNames = providers.map((provider) =>
    getOneKeyIdOAuthProviderName(provider),
  );
  // TODO: i18n (localize the list conjunction via intl.formatList instead of
  // hardcoding ' and ')
  const providerText =
    providerNames.length > 1 ? providerNames.join(' and ') : providerNames[0];

  return (
    <YStack
      bg="$bgSubdued"
      borderWidth={1}
      borderColor="$neutral3"
      borderRadius="$2.5"
      overflow="hidden"
    >
      <ListItem
        py="$3"
        px="$4"
        mx={0}
        borderRadius={0}
        userSelect="none"
        // TODO: i18n (use a {provider} placeholder)
        title={`${providerText} Sign-In linked`}
        titleProps={{
          size: '$bodyMdMedium',
          color: '$text',
        }}
        renderIcon={
          <XStack
            w={22}
            h={22}
            ai="center"
            jc="center"
            gap="$0.5"
            flexShrink={0}
          >
            {providers.map((provider) => (
              <Icon
                key={provider}
                name={getOneKeyIdOAuthProviderIcon(provider)}
                size={providers.length > 1 ? 12 : 18}
                color="$iconSubdued"
              />
            ))}
          </XStack>
        }
      />
    </YStack>
  );
}

export function OneKeyIdLegacyOAuthBindPrompt({
  isLoggedIn,
  isFocused,
}: {
  isLoggedIn: boolean;
  isFocused: boolean;
}) {
  const { user } = useOneKeyAuth();
  const onekeyAccount = user?.onekeyAccount;
  const boundOAuthProviders = useMemo(
    () => getBoundOAuthProviders(onekeyAccount),
    [onekeyAccount],
  );
  const shouldShowBindPrompt = useMemo(
    () => isLegacyOneKeyIdAccountMissingOAuthIdentity(onekeyAccount),
    [onekeyAccount],
  );

  useEffect(() => {
    const refreshProfile = async () => {
      if (!isLoggedIn || !isFocused) {
        return;
      }
      try {
        await backgroundApiProxy.servicePrime.apiFetchPrimeUserInfo();
      } catch (error) {
        console.error('OneKeyIdLegacyOAuthBindPrompt refresh failed:', error);
      }
    };

    void refreshProfile();
  }, [isFocused, isLoggedIn]);

  if (!isLoggedIn) {
    return null;
  }

  if (boundOAuthProviders.length > 0) {
    return <OneKeyIdOAuthBindStatus providers={boundOAuthProviders} />;
  }

  if (!shouldShowBindPrompt) {
    return null;
  }

  return (
    <YStack
      p="$4"
      gap="$3"
      bg="$bgSubdued"
      borderWidth={1}
      borderColor="$neutral3"
      borderRadius="$2.5"
    >
      <OneKeyIdLegacyOAuthBindHeader />
      <OneKeyIdLegacyOAuthBindActions fullWidth />
    </YStack>
  );
}

export async function showOneKeyIdLegacyOAuthBindDialog({
  bindProvider,
  onBindSuccess,
  shouldSkipBeforeShow,
  checkBindRequired = true,
}: {
  bindProvider?: EOAuthSocialLoginProvider;
  onBindSuccess?: () => void | Promise<void>;
  shouldSkipBeforeShow?: () => boolean;
  checkBindRequired?: boolean;
} = {}) {
  if (isLegacyOAuthBindDialogVisible) {
    return false;
  }
  isLegacyOAuthBindDialogVisible = true;

  try {
    let bindRequired = false;
    if (checkBindRequired) {
      try {
        bindRequired =
          await backgroundApiProxy.servicePrime.isLegacyOneKeyIdOAuthBindRequired();
      } catch (error) {
        console.error('showOneKeyIdLegacyOAuthBindDialog failed:', error);
      }
    } else {
      bindRequired = true;
    }

    if (!bindRequired) {
      return false;
    }
    if (shouldSkipBeforeShow?.()) {
      return false;
    }

    const didBind = await new Promise<boolean>((resolve) => {
      if (shouldSkipBeforeShow?.()) {
        resolve(false);
        return;
      }
      let isSettled = false;
      const resolveOnce = (value: boolean) => {
        if (!isSettled) {
          isSettled = true;
          resolve(value);
        }
      };
      const dialog = Dialog.show({
        onCancel: () => resolveOnce(false),
        onClose: () => resolveOnce(false),
        renderContent: (
          <OneKeyIdLegacyOAuthBindDialogContent
            bindProvider={bindProvider}
            onBindSuccess={async () => {
              if (!isSettled) {
                isSettled = true;
                await dialog.close({ flag: 'confirm' });
                resolve(true);
              }
            }}
            onBeforeShowNestedDialog={async () => {
              if (!isSettled) {
                isSettled = true;
                await dialog.close();
                resolve(false);
              }
            }}
          />
        ),
      });
    });

    if (didBind) {
      await onBindSuccess?.();
    }

    return didBind;
  } finally {
    isLegacyOAuthBindDialogVisible = false;
  }
}

export async function showOneKeyIdLegacyOAuthBindDialogAfterLegacyEmailOtpLogin() {
  // Only show this after an explicit legacy email OTP login succeeds. Do not
  // call it from bootstrap, refresh, or passive session restore paths.
  return showOneKeyIdLegacyOAuthBindDialog();
}

export async function showOneKeyIdLegacyOAuthBindDialogForLocalKeylessUpgrade({
  onekeyUserId,
  shouldSkip,
}: {
  onekeyUserId: string | undefined;
  shouldSkip?: () => boolean;
}) {
  if (!onekeyUserId || shouldSkip?.()) {
    return false;
  }

  // The whole decision pipeline (per-user throttle, local keyless wallet
  // existence, legacy bind-required check) is evaluated and marked
  // atomically in the bg service, so concurrent UI contexts (ext popup /
  // sidepanel / expanded tab) cannot double-prompt, and the expensive
  // checks run at most once per throttle window regardless of outcome.
  const shouldShow =
    await backgroundApiProxy.servicePrime.checkAndMarkShouldShowLocalKeylessUpgradeBindPrompt(
      {
        onekeyUserId,
        trigger: 'localKeylessUpgradeAutoCheck',
      },
    );
  if (!shouldShow) {
    return false;
  }

  // This is the only passive restore path that may auto-show the bind dialog:
  // legacy OneKey ID is still email-only while a local Keyless wallet already
  // exists from the old version.
  // NOTE: the throttle window is already consumed by the bg gate above; if
  // shouldSkipBeforeShow skips here (e.g. the app got locked while the bg
  // check was in flight), the prompt waits for the next throttle window.
  return showOneKeyIdLegacyOAuthBindDialog({
    checkBindRequired: false,
    shouldSkipBeforeShow: shouldSkip,
  });
}
