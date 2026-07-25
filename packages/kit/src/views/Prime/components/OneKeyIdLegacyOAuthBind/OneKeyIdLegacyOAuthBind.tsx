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
  redirectKeylessOneKeyIdAuthToExtExpandTab,
  redirectOneKeyIdAuthToExtExpandTab,
  shouldRunOneKeyIdAuthInExtExpandTab,
} from '@onekeyhq/kit/src/components/OneKeyAuth/extOneKeyIdAuthExpandTab';
import { getDisplayEmailOrUnknown } from '@onekeyhq/kit/src/components/OneKeyAuth/oneKeyIdDisplayEmailUtils';
import { useIdentityExitFlow } from '@onekeyhq/kit/src/components/OneKeyAuth/useIdentityExitFlow';
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
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EOnboardingV2OneKeyIDLoginMode } from '@onekeyhq/shared/src/routes';
import { shouldClearKeylessOAuthSessionAfterError } from '@onekeyhq/shared/src/utils/keylessOAuthSessionUtils';
import {
  getBoundOAuthProviders,
  getOAuthSocialLoginProviderName,
  getOneKeyIdOAuthProviderIcon,
  getOneKeyIdOAuthProviderName,
} from '@onekeyhq/shared/src/utils/oauthProviderUtils';
import { isLegacyOneKeyIdAccountMissingOAuthIdentity } from '@onekeyhq/shared/src/utils/oneKeyIdAccountUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IKeylessOAuthSessionRollbackHandle } from '@onekeyhq/shared/types/prime/identityExitTypes';
import type { EOneKeyIdOAuthProvider } from '@onekeyhq/shared/types/prime/primeTypes';

import { showOneKeyIdLoginSuccessToast } from '../oneKeyIdLoginToastUtils';
import { useOneKeyIdLocalKeylessOAuth } from '../useOneKeyIdLocalKeylessOAuth';

import { getOneKeyIdOAuthBindProviders } from './oneKeyIdOAuthBindProviders';

import type { IntlShape } from 'react-intl';

// TODO: i18n
export const ONEKEY_ID_BIND_OAUTH_TITLE = 'Add Another Sign-In Method';
// TODO: i18n
export const ONEKEY_ID_BIND_OAUTH_DESC =
  'You can continue using email. Optionally link Google or Apple for another way to access your OneKey ID.';
let isLegacyOAuthBindDialogVisible = false;

const PREPARE_LOCAL_KEYLESS_MAX_ATTEMPTS = 3;
const PREPARE_LOCAL_KEYLESS_RETRY_DELAY_MS = 1000;

function getSanitizedAuthError(error: unknown): string {
  const safeError = error as {
    message?: unknown;
    code?: unknown;
    status?: unknown;
    httpStatusCode?: unknown;
    requestId?: unknown;
  };
  return `message=${String(safeError?.message || 'unknown')} code=${String(
    safeError?.code || '',
  )} status=${String(
    safeError?.status || safeError?.httpStatusCode || '',
  )} requestId=${String(safeError?.requestId || '')}`;
}

// TODO: i18n (use a {provider} placeholder)
function getBindOAuthTitle(provider?: EOAuthSocialLoginProvider) {
  return provider
    ? `Add ${getOAuthSocialLoginProviderName(provider)} Sign-In`
    : ONEKEY_ID_BIND_OAUTH_TITLE;
}

// TODO: i18n (use a {provider} placeholder)
function getBindOAuthDescription({
  provider,
  isRequiredForKeyless,
}: {
  provider?: EOAuthSocialLoginProvider;
  isRequiredForKeyless: boolean;
}) {
  if (!provider) {
    return ONEKEY_ID_BIND_OAUTH_DESC;
  }
  if (isRequiredForKeyless) {
    return `Link ${getOAuthSocialLoginProviderName(
      provider,
    )} to continue creating or recovering your Keyless wallet. Email sign-in will remain available for your OneKey ID.`;
  }
  return `You can continue using email. Optionally link ${getOAuthSocialLoginProviderName(
    provider,
  )} for another way to access your OneKey ID.`;
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
  isRequiredForKeyless,
}: {
  bindProvider?: EOAuthSocialLoginProvider;
  inDialog?: boolean;
  isRequiredForKeyless: boolean;
}) {
  const title = getBindOAuthTitle(bindProvider);
  const description = getBindOAuthDescription({
    provider: bindProvider,
    isRequiredForKeyless,
  });

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
  isRequiredForKeyless,
  buttonSize = 'small',
  onBindSuccess,
  onBeforeShowNestedDialog,
}: {
  bindProvider?: EOAuthSocialLoginProvider;
  isRequiredForKeyless: boolean;
  buttonSize?: 'small' | 'large';
  onBindSuccess?: () => void | Promise<void>;
  // Called when the flow hands off to another dialog (keyless logout, switch
  // account): the host bind dialog should close itself and settle as
  // not-bound before the nested dialog shows.
  onBeforeShowNestedDialog?: () => void | Promise<void>;
}) {
  const intl = useIntl();
  const { run: runIdentityExit } = useIdentityExitFlow();
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
    localKeylessWalletId,
    isLocalKeylessOAuthMode,
    getOAuthAccessToken,
    rollbackProvisionalOAuthSession,
  } = useOneKeyIdLocalKeylessOAuth({
    localKeylessLoginPrepareResult,
    onAccountMismatch: handleAccountMismatch,
    forceAccountMismatchToast: true,
  });
  const bindProviders = getOneKeyIdOAuthBindProviders({
    localKeylessProvider,
    requiredProvider: bindProvider,
  });

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
              getSanitizedAuthError(error),
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
      rollbackHandle,
    }: {
      provider: EOAuthSocialLoginProvider;
      oauthAccessToken: string;
      rollbackHandle?: IKeylessOAuthSessionRollbackHandle;
    }) => {
      const confirmed = await showOneKeyIdOAuthIdentityAlreadyBoundSwitchDialog(
        {
          intl,
          provider,
          hasLocalKeylessWallet: isLocalKeylessOAuthMode,
        },
      );
      if (!confirmed) {
        if (rollbackHandle) {
          await rollbackProvisionalOAuthSession({ rollbackHandle });
        }
        return;
      }
      try {
        const exitResult = await runIdentityExit({
          type: 'switchOneKeyIdAccount',
          scene: 'legacyOAuthBind',
        });
        if (exitResult.status !== 'completed') {
          if (rollbackHandle) {
            await rollbackProvisionalOAuthSession({ rollbackHandle });
          }
          return;
        }
        await backgroundApiProxy.servicePrime.apiOAuthLogin({
          accessToken: oauthAccessToken,
        });
      } catch (error) {
        if (rollbackHandle && shouldClearKeylessOAuthSessionAfterError(error)) {
          await rollbackProvisionalOAuthSession({ rollbackHandle });
        }
        throw error;
      }
      showOneKeyIdLoginSuccessToast(intl);
    },
    [
      intl,
      isLocalKeylessOAuthMode,
      rollbackProvisionalOAuthSession,
      runIdentityExit,
    ],
  );

  const handleBindOAuth = useCallback(
    async (provider: EOAuthSocialLoginProvider) => {
      if (bindingProviderRef.current) {
        return;
      }
      // launchWebAuthFlow can never complete in the ext action popup (Chrome
      // destroys it on focus loss), so hand the bind flow off to the expand
      // tab. Guarding the button press (not the mount) prevents an optional
      // prompt from opening a tab before the user chooses a provider, and it
      // also covers the inline bind prompt on the OneKey ID page.
      if (shouldRunOneKeyIdAuthInExtExpandTab()) {
        if (isRequiredForKeyless) {
          // A required Keyless bind has an in-memory continuation that cannot
          // survive the popup being destroyed. Resume from the provider-
          // specific onboarding entry in the expand tab; it re-runs prepare,
          // opens this same bind dialog, and owns the create/restore follow-up.
          await redirectKeylessOneKeyIdAuthToExtExpandTab({
            mode: EOnboardingV2OneKeyIDLoginMode.KeylessCreateOrRestore,
            provider,
          });
        } else {
          await redirectOneKeyIdAuthToExtExpandTab({
            flow: EExtOneKeyIdAuthFlow.LegacyOAuthBind,
            provider,
          });
        }
        return;
      }
      bindingProviderRef.current = provider;
      setBindingProvider(provider);
      try {
        setShowKeylessLogoutAction(false);
        await errorToastUtils.withErrorAutoToast(async () => {
          let oauthAccessToken = '';
          let rollbackHandle: IKeylessOAuthSessionRollbackHandle | undefined;
          try {
            const result = await getOAuthAccessToken({
              provider,
              // TODO: i18n (surfaces as a raw toast via withErrorAutoToast)
              missingTokenMessage: 'OAuth bind failed: access token not found',
            });
            oauthAccessToken = result.accessToken;
            rollbackHandle = result.rollbackHandle;
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
                rollbackHandle,
              });
              return;
            }
            if (
              rollbackHandle &&
              shouldClearKeylessOAuthSessionAfterError(error)
            ) {
              await rollbackProvisionalOAuthSession({ rollbackHandle });
            }
            throw error;
          }
          // The bind POST has committed irreversibly at this point (server
          // identity added, bg auth source/atom already switched to
          // KeylessOAuth), so the flow must settle as a success from here on:
          // post-commit failures must not flow into withErrorAutoToast /
          // onBindError, which would report a committed bind as failed —
          // and a retry can never succeed because the legacy auth slot is
          // already cleared by the bg method.
          try {
            await onBindSuccess?.();
          } catch (bindSuccessHandlerError) {
            // onBindSuccess settles/closes the host dialog (it resolves
            // didBind=true before a dialog-close failure can propagate
            // here); any follow-up continuation errors surface through the
            // continuation's own error handling, so only log here.
            defaultLogger.prime.subscription.onekeyIdLogout({
              reason: `OneKeyIdLegacyOAuthBindActions: onBindSuccess failed after bind committed: ${String(
                bindSuccessHandlerError,
              )}`,
            });
          }
          Toast.success({
            title: intl.formatMessage({ id: ETranslations.global_success }),
          });
        });
      } catch (error) {
        console.error(
          'OneKeyIdLegacyOAuthBindActions bind failed:',
          getSanitizedAuthError(error),
        );
      } finally {
        bindingProviderRef.current = null;
        setBindingProvider(null);
      }
    },
    [
      getOAuthAccessToken,
      handleSwitchToBoundOneKeyId,
      intl,
      isRequiredForKeyless,
      onBeforeShowNestedDialog,
      onBindSuccess,
      rollbackProvisionalOAuthSession,
    ],
  );

  const handleLogoutKeylessWallet = useCallback(async () => {
    if (bindingProviderRef.current || !localKeylessWalletId) {
      return;
    }
    await runIdentityExit(
      {
        type: 'removeKeyless',
        expectedWalletId: localKeylessWalletId,
        scene: 'oneKeyIdLogin',
      },
      {
        beforePresentReadyPlan: async () => {
          await onBeforeShowNestedDialog?.();
          await timerUtils.wait(300);
        },
      },
    );
  }, [localKeylessWalletId, onBeforeShowNestedDialog, runIdentityExit]);

  return (
    <YStack gap={buttonSize === 'large' ? '$3' : '$2'} width="100%">
      {bindProviders.map((provider) => {
        const providerName = getOAuthSocialLoginProviderName(provider);
        return (
          <Button
            key={provider}
            size={buttonSize}
            icon={
              provider === EOAuthSocialLoginProvider.Google
                ? 'GoogleIllus'
                : 'AppleBrand'
            }
            testID={`onekey-id-bind-oauth-${provider}-btn`}
            width="100%"
            loading={bindingProvider === provider}
            disabled={
              Boolean(bindingProvider) || !localKeylessLoginPrepareResult
            }
            onPress={() => void handleBindOAuth(provider)}
          >
            {intl.formatMessage(
              { id: ETranslations.continue_with_social_platform },
              { platform: providerName },
            )}
          </Button>
        );
      })}
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

function OneKeyIdLegacyOAuthBindContent({
  presentation,
  bindProvider,
  isRequiredForKeyless = false,
  onBindSuccess,
  onBeforeShowNestedDialog,
}: {
  presentation: 'dialog' | 'inline';
  bindProvider?: EOAuthSocialLoginProvider;
  isRequiredForKeyless?: boolean;
  onBindSuccess?: () => void | Promise<void>;
  onBeforeShowNestedDialog?: () => void | Promise<void>;
}) {
  const isDialog = presentation === 'dialog';
  const content = (
    <>
      <OneKeyIdLegacyOAuthBindHeader
        bindProvider={bindProvider}
        inDialog={isDialog}
        isRequiredForKeyless={isRequiredForKeyless}
      />
      <OneKeyIdLegacyOAuthBindActions
        bindProvider={bindProvider}
        isRequiredForKeyless={isRequiredForKeyless}
        buttonSize={isDialog ? 'large' : 'small'}
        onBindSuccess={onBindSuccess}
        onBeforeShowNestedDialog={onBeforeShowNestedDialog}
      />
    </>
  );

  if (isDialog) {
    return (
      <Stack>
        {content}
        <Dialog.Footer showConfirmButton={false} showCancelButton />
      </Stack>
    );
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
      {content}
    </YStack>
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
        console.error(
          'OneKeyIdLegacyOAuthBindPrompt refresh failed:',
          getSanitizedAuthError(error),
        );
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

  return <OneKeyIdLegacyOAuthBindContent presentation="inline" />;
}

type IOneKeyIdOAuthBindDialogIntent =
  | {
      type: 'check-required';
      provider?: EOAuthSocialLoginProvider;
    }
  | { type: 'post-email-login' }
  | {
      type: 'required-for-keyless';
      provider: EOAuthSocialLoginProvider;
      onBindSuccess: () => void | Promise<void>;
    };

async function shouldShowOneKeyIdOAuthBindDialog(
  intent: IOneKeyIdOAuthBindDialogIntent,
): Promise<boolean> {
  if (intent.type === 'required-for-keyless') {
    return true;
  }

  if (intent.type === 'post-email-login') {
    const userInfo = await backgroundApiProxy.servicePrime.getLocalUserInfo();
    if (!userInfo?.onekeyUserId) {
      return false;
    }
    return backgroundApiProxy.servicePrime.checkAndMarkShouldShowOneKeyIdOAuthBindPrompt(
      { onekeyUserId: userInfo.onekeyUserId },
    );
  }

  try {
    return await backgroundApiProxy.servicePrime.isLegacyOneKeyIdOAuthBindRequired();
  } catch (error) {
    console.error(
      'showOneKeyIdLegacyOAuthBindDialog failed:',
      getSanitizedAuthError(error),
    );
    return false;
  }
}

export async function showOneKeyIdLegacyOAuthBindDialog(
  intent: IOneKeyIdOAuthBindDialogIntent = { type: 'check-required' },
) {
  if (isLegacyOAuthBindDialogVisible) {
    return false;
  }
  isLegacyOAuthBindDialogVisible = true;

  try {
    if (!(await shouldShowOneKeyIdOAuthBindDialog(intent))) {
      return false;
    }

    const isRequiredForKeyless = intent.type === 'required-for-keyless';
    const bindProvider =
      intent.type === 'required-for-keyless' || intent.type === 'check-required'
        ? intent.provider
        : undefined;
    const onBindSuccess = isRequiredForKeyless
      ? intent.onBindSuccess
      : undefined;

    const didBind = await new Promise<boolean>((resolve) => {
      let isSettled = false;
      const resolveOnce = (value: boolean) => {
        if (!isSettled) {
          isSettled = true;
          resolve(value);
        }
      };
      const dialog = Dialog.show({
        dismissOnOverlayPress: false,
        disableDrag: true,
        disableSystemClose: true,
        onCancel: () => resolveOnce(false),
        onClose: () => resolveOnce(false),
        renderContent: (
          <OneKeyIdLegacyOAuthBindContent
            presentation="dialog"
            bindProvider={bindProvider}
            isRequiredForKeyless={isRequiredForKeyless}
            onBindSuccess={async () => {
              if (!isSettled) {
                isSettled = true;
                // The bind has already committed when this runs, and
                // isSettled=true blocks onClose/onCancel from settling, so
                // didBind must resolve true even if closing the dialog
                // throws; the close error itself is logged (not toasted) by
                // the bind actions.
                try {
                  await dialog.close({ flag: 'confirm' });
                } finally {
                  resolve(true);
                }
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
