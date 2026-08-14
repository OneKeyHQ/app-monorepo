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
import { MultipleClickStack } from '@onekeyhq/kit/src/components/MultipleClickStack';
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

import {
  getSanitizedAuthErrorText,
  logOneKeyIdLoginFailureReason,
  showOneKeyIdLoginSuccessToast,
  throwLocalizedOneKeyIdLoginError,
} from '../oneKeyIdLoginToastUtils';
import { useOneKeyIdLocalKeylessOAuth } from '../useOneKeyIdLocalKeylessOAuth';

import { getOneKeyIdOAuthBindProviders } from './oneKeyIdOAuthBindProviders';

import type { IntlShape } from 'react-intl';

let isLegacyOAuthBindDialogVisible = false;
let pendingRequiredKeylessBindDialogCount = 0;
const legacyOAuthBindDialogAvailableWaiters = new Set<() => void>();

const PREPARE_LOCAL_KEYLESS_MAX_ATTEMPTS = 3;
const PREPARE_LOCAL_KEYLESS_RETRY_DELAY_MS = 1000;
const CREDENTIAL_UPGRADE_PROMPT_MAX_ATTEMPTS = 3;
const CREDENTIAL_UPGRADE_PROMPT_RETRY_DELAY_MS = 1000;

type IOneKeyIdOAuthAccountSwitchResult = 'switched' | 'cancelled' | 'failed';
type IOneKeyIdOAuthBindDialogResult =
  | 'bound'
  | IOneKeyIdOAuthAccountSwitchResult;

function getBindOAuthTitle({
  intl,
  provider,
}: {
  intl: IntlShape;
  provider?: EOAuthSocialLoginProvider;
}) {
  return provider
    ? intl.formatMessage(
        { id: ETranslations.link_social_platform__title },
        { platform: getOAuthSocialLoginProviderName(provider) },
      )
    : intl.formatMessage({
        id: ETranslations.add_sign_in_method__title,
      });
}

function getBindOAuthDescription({
  intl,
  provider,
  isRequiredForKeyless,
}: {
  intl: IntlShape;
  provider?: EOAuthSocialLoginProvider;
  isRequiredForKeyless: boolean;
}) {
  const providerName = provider
    ? getOAuthSocialLoginProviderName(provider)
    : intl.formatMessage({
        id: ETranslations.google_or_apple__label,
      });
  if (provider && isRequiredForKeyless) {
    return intl.formatMessage(
      { id: ETranslations.link_provider_for_keyless__desc },
      { provider: providerName },
    );
  }
  return intl.formatMessage(
    { id: ETranslations.add_sign_in_method__desc },
    { provider: providerName },
  );
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
  } catch (error) {
    logOneKeyIdLoginFailureReason(
      `OneKey ID bound-account dialog local profile read failed: ${getSanitizedAuthErrorText(
        error,
      )}`,
      error,
    );
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
      title: intl.formatMessage({
        id: ETranslations.oauth_account_already_linked__title,
      }),
      description: intl.formatMessage(
        {
          id: hasLocalKeylessWallet
            ? ETranslations.oauth_account_already_linked_switch_keyless__desc
            : ETranslations.oauth_account_already_linked_switch__desc,
        },
        {
          provider: providerName,
          email: emailText,
        },
      ),
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
  onTitleMultipleClick,
}: {
  bindProvider?: EOAuthSocialLoginProvider;
  inDialog?: boolean;
  isRequiredForKeyless: boolean;
  onTitleMultipleClick?: () => void | Promise<void>;
}) {
  const intl = useIntl();
  const title = getBindOAuthTitle({ intl, provider: bindProvider });
  const description = getBindOAuthDescription({
    intl,
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
      <MultipleClickStack
        devSettingsOnly
        testID="onekey-id-bind-oauth-reset-prompt-trigger"
        onPress={() => void onTitleMultipleClick?.()}
      >
        <SizableText size="$bodyMdMedium" color="$text">
          {title}
        </SizableText>
      </MultipleClickStack>
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
  onBeforeShowAccountSwitchDialog,
  onAccountSwitchResult,
}: {
  bindProvider?: EOAuthSocialLoginProvider;
  isRequiredForKeyless: boolean;
  buttonSize?: 'small' | 'large';
  onBindSuccess?: () => void | Promise<void>;
  // Keyless logout ends the bind flow before its nested dialog is shown.
  onBeforeShowNestedDialog?: () => void | Promise<void>;
  // Account switching keeps the bind flow pending until its nested dialog
  // reports whether OAuth login completed.
  onBeforeShowAccountSwitchDialog?: () => void | Promise<void>;
  onAccountSwitchResult?: (
    result: IOneKeyIdOAuthAccountSwitchResult,
  ) => void | Promise<void>;
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
            logOneKeyIdLoginFailureReason(
              `OneKeyIdLegacyOAuthBindActions preparation failed after retries: ${getSanitizedAuthErrorText(
                error,
              )}`,
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
      rollbackHandle,
    }: {
      provider: EOAuthSocialLoginProvider;
      oauthAccessToken: string;
      rollbackHandle?: IKeylessOAuthSessionRollbackHandle;
    }): Promise<boolean> => {
      let confirmed = false;
      try {
        confirmed = await showOneKeyIdOAuthIdentityAlreadyBoundSwitchDialog({
          intl,
          provider,
          hasLocalKeylessWallet: isLocalKeylessOAuthMode,
        });
      } catch (error) {
        if (rollbackHandle) {
          try {
            await rollbackProvisionalOAuthSession({ rollbackHandle });
          } catch (rollbackError) {
            // A failed rollback must not replace the original error.
            logOneKeyIdLoginFailureReason(
              `OneKey ID OAuth session rollback failed: ${getSanitizedAuthErrorText(
                rollbackError,
              )}`,
              rollbackError,
            );
          }
        }
        throw error;
      }
      if (!confirmed) {
        if (rollbackHandle) {
          await rollbackProvisionalOAuthSession({ rollbackHandle });
        }
        return false;
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
          return false;
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
      return true;
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
          // Capture the account the user is consenting to bind at press
          // time, BEFORE the user-paced OAuth round-trip: the bg method
          // re-asserts it right before the irreversible bind POST, so a
          // concurrent login switch on another surface (ext popup vs expand
          // tab) aborts the bind instead of permanently attaching the OAuth
          // identity to whichever account then occupies the legacy slot.
          const { isLoggedIn, onekeyUserId: expectedOnekeyUserId } =
            await backgroundApiProxy.servicePrime.getLocalUserInfo();
          if (!isLoggedIn || !expectedOnekeyUserId) {
            throwLocalizedOneKeyIdLoginError({
              intl,
              reason: 'OAuth bind failed: OneKey ID is not logged in',
            });
          }
          let oauthAccessToken = '';
          let rollbackHandle: IKeylessOAuthSessionRollbackHandle | undefined;
          try {
            const result = await getOAuthAccessToken({
              provider,
              missingTokenMessage: intl.formatMessage({
                id: ETranslations.global_unknown_error_retry_message,
              }),
            });
            oauthAccessToken = result.accessToken;
            rollbackHandle = result.rollbackHandle;
            await backgroundApiProxy.servicePrime.apiBindLegacyOneKeyIdOAuth({
              oauthAccessToken,
              expectedOnekeyUserId,
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
              let accountSwitchResult: IOneKeyIdOAuthAccountSwitchResult =
                'failed';
              try {
                await onBeforeShowAccountSwitchDialog?.();
                await timerUtils.wait(300);
                accountSwitchResult = (await handleSwitchToBoundOneKeyId({
                  provider,
                  oauthAccessToken,
                  rollbackHandle,
                }))
                  ? 'switched'
                  : 'cancelled';
              } catch (accountSwitchError) {
                await onAccountSwitchResult?.('failed');
                throw accountSwitchError;
              }
              await onAccountSwitchResult?.(accountSwitchResult);
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
              reason: `OneKeyIdLegacyOAuthBindActions: onBindSuccess failed after bind committed: ${getSanitizedAuthErrorText(
                bindSuccessHandlerError,
              )}`,
            });
          }
          Toast.success({
            title: intl.formatMessage({ id: ETranslations.global_success }),
          });
        });
      } catch (error) {
        logOneKeyIdLoginFailureReason(
          `OneKeyIdLegacyOAuthBindActions bind failed: ${getSanitizedAuthErrorText(
            error,
          )}`,
          error,
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
      onAccountSwitchResult,
      onBeforeShowAccountSwitchDialog,
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
              { id: ETranslations.link_social_platform__action },
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
  onBeforeShowAccountSwitchDialog,
  onAccountSwitchResult,
  onTitleMultipleClick,
}: {
  presentation: 'dialog' | 'inline';
  bindProvider?: EOAuthSocialLoginProvider;
  isRequiredForKeyless?: boolean;
  onBindSuccess?: () => void | Promise<void>;
  onBeforeShowNestedDialog?: () => void | Promise<void>;
  onBeforeShowAccountSwitchDialog?: () => void | Promise<void>;
  onAccountSwitchResult?: (
    result: IOneKeyIdOAuthAccountSwitchResult,
  ) => void | Promise<void>;
  onTitleMultipleClick?: () => void | Promise<void>;
}) {
  const isDialog = presentation === 'dialog';
  const content = (
    <>
      <OneKeyIdLegacyOAuthBindHeader
        bindProvider={bindProvider}
        inDialog={isDialog}
        isRequiredForKeyless={isRequiredForKeyless}
        onTitleMultipleClick={onTitleMultipleClick}
      />
      <OneKeyIdLegacyOAuthBindActions
        bindProvider={bindProvider}
        isRequiredForKeyless={isRequiredForKeyless}
        buttonSize={isDialog ? 'large' : 'small'}
        onBindSuccess={onBindSuccess}
        onBeforeShowNestedDialog={onBeforeShowNestedDialog}
        onBeforeShowAccountSwitchDialog={onBeforeShowAccountSwitchDialog}
        onAccountSwitchResult={onAccountSwitchResult}
      />
    </>
  );

  if (isDialog) {
    return (
      <Stack>
        {content}
        <Dialog.Footer showConfirmButton={false} showCancelButton={false} />
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
  const intl = useIntl();
  const providerNames = providers.map((provider) =>
    getOneKeyIdOAuthProviderName(provider),
  );
  const providerText =
    providerNames.length > 1
      ? intl.formatMessage({ id: ETranslations.google_and_apple__label })
      : providerNames[0];

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
        title={intl.formatMessage(
          { id: ETranslations.social_sign_in_linked__title },
          { provider: providerText },
        )}
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
  const [isKeylessCredentialReady, setIsKeylessCredentialReady] =
    useState(false);
  const handleResetBindPrompt = useCallback(async () => {
    if (!user?.onekeyUserId) {
      return;
    }
    try {
      await backgroundApiProxy.simpleDb.prime.resetOneKeyIdOAuthBindPromptShown(
        {
          onekeyUserId: user.onekeyUserId,
        },
      );
      Toast.success({
        title: 'OneKey ID bind reminder reset. Reload to test.',
      });
    } catch (error) {
      logOneKeyIdLoginFailureReason(
        `OneKeyIdLegacyOAuthBindPrompt reset failed: ${getSanitizedAuthErrorText(
          error,
        )}`,
        error,
      );
      Toast.error({
        title: 'Failed to reset OneKey ID bind reminder',
      });
    }
  }, [user?.onekeyUserId]);

  useEffect(() => {
    let isCancelled = false;
    const refreshProfile = async () => {
      if (!isLoggedIn || !isFocused) {
        setIsKeylessCredentialReady(false);
        return;
      }
      try {
        const keylessCredentialReadiness =
          await backgroundApiProxy.serviceKeylessWallet.ensureKeylessCredentialReadyForOneKeyIdBind();
        if (isCancelled) {
          return;
        }
        const isReady =
          keylessCredentialReadiness.status !== 'retryableIndeterminate';
        setIsKeylessCredentialReady(isReady);
        if (!isReady) {
          return;
        }
      } catch (error) {
        if (!isCancelled) {
          setIsKeylessCredentialReady(false);
        }
        logOneKeyIdLoginFailureReason(
          `OneKeyIdLegacyOAuthBindPrompt credential readiness refresh failed: ${getSanitizedAuthErrorText(
            error,
          )}`,
          error,
        );
        return;
      }
      try {
        await backgroundApiProxy.servicePrime.apiFetchPrimeUserInfo();
      } catch (error) {
        logOneKeyIdLoginFailureReason(
          `OneKeyIdLegacyOAuthBindPrompt profile refresh failed: ${getSanitizedAuthErrorText(
            error,
          )}`,
          error,
        );
      }
    };

    void refreshProfile();
    return () => {
      isCancelled = true;
    };
  }, [isFocused, isLoggedIn]);

  if (!isLoggedIn) {
    return null;
  }

  if (boundOAuthProviders.length > 0) {
    return <OneKeyIdOAuthBindStatus providers={boundOAuthProviders} />;
  }

  if (!isKeylessCredentialReady || !shouldShowBindPrompt) {
    return null;
  }

  return (
    <OneKeyIdLegacyOAuthBindContent
      presentation="inline"
      onTitleMultipleClick={handleResetBindPrompt}
    />
  );
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
    }
  | {
      type: 'credential-upgrade';
      onekeyUserId: string;
      shouldSkipBeforeShow?: () => boolean;
    };

type IOneKeyIdOAuthBindPromptClaim = {
  onekeyUserId: string;
  claimId: string;
};

const ONEKEY_ID_OAUTH_BIND_DIALOG_PRESENTATION_TIMEOUT_MS = 5000;

async function prepareOneKeyIdOAuthBindDialog(
  intent: IOneKeyIdOAuthBindDialogIntent,
): Promise<{
  shouldShow: boolean;
  promptClaim?: IOneKeyIdOAuthBindPromptClaim;
  retryable?: boolean;
}> {
  if (intent.type === 'required-for-keyless') {
    return { shouldShow: true };
  }

  if (
    intent.type === 'post-email-login' ||
    intent.type === 'credential-upgrade'
  ) {
    const onekeyUserId =
      intent.type === 'credential-upgrade'
        ? intent.onekeyUserId
        : (await backgroundApiProxy.servicePrime.getLocalUserInfo())
            ?.onekeyUserId;
    if (!onekeyUserId) {
      return { shouldShow: false };
    }
    const claim =
      await backgroundApiProxy.servicePrime.claimOneKeyIdOAuthBindPrompt({
        onekeyUserId,
      });
    if (claim.status === 'retryable') {
      return { shouldShow: false, retryable: true };
    }
    return claim.status === 'claimed'
      ? {
          shouldShow: true,
          promptClaim: { onekeyUserId, claimId: claim.claimId },
        }
      : { shouldShow: false };
  }

  try {
    return {
      shouldShow:
        await backgroundApiProxy.servicePrime.isLegacyOneKeyIdOAuthBindRequired(),
    };
  } catch (error) {
    logOneKeyIdLoginFailureReason(
      `showOneKeyIdLegacyOAuthBindDialog requirement check failed: ${getSanitizedAuthErrorText(
        error,
      )}`,
      error,
    );
    return { shouldShow: false };
  }
}

async function completeOneKeyIdOAuthBindPromptClaim(
  claim: IOneKeyIdOAuthBindPromptClaim,
) {
  return backgroundApiProxy.servicePrime.completeOneKeyIdOAuthBindPrompt(claim);
}

async function releaseOneKeyIdOAuthBindPromptClaim(
  claim: IOneKeyIdOAuthBindPromptClaim,
) {
  try {
    await backgroundApiProxy.servicePrime.releaseOneKeyIdOAuthBindPrompt(claim);
  } catch (error) {
    logOneKeyIdLoginFailureReason(
      `showOneKeyIdLegacyOAuthBindDialog claim release failed: ${getSanitizedAuthErrorText(
        error,
      )}`,
      error,
    );
  }
}

function tryAcquireOptionalLegacyOAuthBindDialogPresentation() {
  if (
    isLegacyOAuthBindDialogVisible ||
    pendingRequiredKeylessBindDialogCount > 0
  ) {
    return false;
  }
  isLegacyOAuthBindDialogVisible = true;
  return true;
}

async function acquireRequiredLegacyOAuthBindDialogPresentation(): Promise<true> {
  if (isLegacyOAuthBindDialogVisible) {
    await new Promise<void>((resolve) => {
      legacyOAuthBindDialogAvailableWaiters.add(resolve);
    });
    return acquireRequiredLegacyOAuthBindDialogPresentation();
  }
  isLegacyOAuthBindDialogVisible = true;
  return true;
}

function releaseLegacyOAuthBindDialogPresentation() {
  isLegacyOAuthBindDialogVisible = false;
  const waiters = [...legacyOAuthBindDialogAvailableWaiters];
  legacyOAuthBindDialogAvailableWaiters.clear();
  waiters.forEach((resolve) => resolve());
}

export async function showOneKeyIdLegacyOAuthBindDialog(
  intent: IOneKeyIdOAuthBindDialogIntent = { type: 'check-required' },
) {
  const isRequiredForKeyless = intent.type === 'required-for-keyless';
  if (isRequiredForKeyless) {
    pendingRequiredKeylessBindDialogCount += 1;
  }
  let isRequiredRequestPending = isRequiredForKeyless;
  let ownsDialogPresentation = false;
  let promptClaim: IOneKeyIdOAuthBindPromptClaim | undefined;
  let isPromptClaimCompleted = false;

  try {
    const preparation = await prepareOneKeyIdOAuthBindDialog(intent);
    if (!preparation.shouldShow) {
      return preparation.retryable ? ('retryable' as const) : false;
    }
    promptClaim = preparation.promptClaim;
    if (
      intent.type === 'credential-upgrade' &&
      intent.shouldSkipBeforeShow?.()
    ) {
      return false;
    }

    ownsDialogPresentation = isRequiredForKeyless
      ? await acquireRequiredLegacyOAuthBindDialogPresentation()
      : tryAcquireOptionalLegacyOAuthBindDialogPresentation();
    if (isRequiredForKeyless) {
      pendingRequiredKeylessBindDialogCount -= 1;
      isRequiredRequestPending = false;
    }
    if (!ownsDialogPresentation) {
      return intent.type === 'credential-upgrade'
        ? ('retryable' as const)
        : false;
    }

    const bindProvider =
      intent.type === 'required-for-keyless' || intent.type === 'check-required'
        ? intent.provider
        : undefined;
    const onBindSuccess = isRequiredForKeyless
      ? intent.onBindSuccess
      : undefined;

    let settleDialogPresentation: (presented: boolean) => void = () =>
      undefined;
    const dialogPresentationPromise = new Promise<boolean>((resolve) => {
      let isSettled = false;
      const timeout = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          resolve(false);
        }
      }, ONEKEY_ID_OAUTH_BIND_DIALOG_PRESENTATION_TIMEOUT_MS);
      settleDialogPresentation = (presented) => {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timeout);
          resolve(presented);
        }
      };
    });
    let closePresentedDialog: (() => Promise<void>) | undefined;
    const bindDialogResultPromise = new Promise<IOneKeyIdOAuthBindDialogResult>(
      (resolve) => {
        let isSettled = false;
        let isAccountSwitchDialogPending = false;
        const resolveOnce = (value: IOneKeyIdOAuthBindDialogResult) => {
          if (!isSettled) {
            isSettled = true;
            resolve(value);
          }
        };
        const dialog = Dialog.show({
          dismissOnOverlayPress: false,
          disableDrag: true,
          disableSystemClose: true,
          onOpen: () => {
            settleDialogPresentation(
              !(
                intent.type === 'credential-upgrade' &&
                intent.shouldSkipBeforeShow?.()
              ),
            );
          },
          onCancel: () => {
            settleDialogPresentation(false);
            if (!isAccountSwitchDialogPending) {
              resolveOnce('cancelled');
            }
          },
          onClose: () => {
            settleDialogPresentation(false);
            if (!isAccountSwitchDialogPending) {
              resolveOnce('cancelled');
            }
          },
          renderContent: (
            <OneKeyIdLegacyOAuthBindContent
              presentation="dialog"
              bindProvider={bindProvider}
              isRequiredForKeyless={isRequiredForKeyless}
              onBindSuccess={async () => {
                if (!isSettled) {
                  isSettled = true;
                  try {
                    await dialog.close({ flag: 'confirm' });
                  } finally {
                    resolve('bound');
                  }
                }
              }}
              onBeforeShowNestedDialog={async () => {
                if (!isSettled) {
                  isSettled = true;
                  await dialog.close();
                  resolve('cancelled');
                }
              }}
              onBeforeShowAccountSwitchDialog={async () => {
                if (!isSettled) {
                  isAccountSwitchDialogPending = true;
                  await dialog.close();
                }
              }}
              onAccountSwitchResult={async (result) => {
                if (!isSettled) {
                  isAccountSwitchDialogPending = false;
                  resolveOnce(result);
                }
              }}
            />
          ),
        });
        closePresentedDialog = async () => {
          await dialog.close();
        };
      },
    );

    if (!closePresentedDialog) {
      settleDialogPresentation(false);
      await bindDialogResultPromise;
      return false;
    }

    const didPresentDialog = await dialogPresentationPromise;
    if (!didPresentDialog) {
      try {
        await closePresentedDialog();
      } catch (error) {
        logOneKeyIdLoginFailureReason(
          `OneKey ID bind dialog close failed after presentation rejection: ${getSanitizedAuthErrorText(
            error,
          )}`,
          error,
        );
        // The claim remains unconsumed and will expire if release also fails.
      }
      return false;
    }

    if (promptClaim) {
      let completed = false;
      try {
        completed = await completeOneKeyIdOAuthBindPromptClaim(promptClaim);
      } catch (error) {
        try {
          await closePresentedDialog?.();
        } catch (closeError) {
          logOneKeyIdLoginFailureReason(
            `OneKey ID bind dialog close failed after claim completion error: ${getSanitizedAuthErrorText(
              closeError,
            )}`,
            closeError,
          );
          // Preserve the claim-completion error; the lease will still expire.
        }
        throw error;
      }
      if (!completed) {
        try {
          await closePresentedDialog?.();
        } catch (error) {
          logOneKeyIdLoginFailureReason(
            `OneKey ID bind dialog close failed after incomplete claim: ${getSanitizedAuthErrorText(
              error,
            )}`,
            error,
          );
          // The claim remains unconsumed and will expire if release also fails.
        }
        return false;
      }
      isPromptClaimCompleted = true;
    }

    const bindDialogResult = await bindDialogResultPromise;

    const didCompleteRequiredFlow =
      bindDialogResult === 'bound' || bindDialogResult === 'switched';
    if (isRequiredForKeyless && didCompleteRequiredFlow) {
      await onBindSuccess?.();
    }

    return (
      bindDialogResult === 'bound' ||
      (isRequiredForKeyless && bindDialogResult === 'switched')
    );
  } finally {
    if (isRequiredRequestPending) {
      pendingRequiredKeylessBindDialogCount -= 1;
    }
    if (promptClaim && !isPromptClaimCompleted) {
      await releaseOneKeyIdOAuthBindPromptClaim(promptClaim);
    }
    if (ownsDialogPresentation) {
      releaseLegacyOAuthBindDialogPresentation();
    }
  }
}

/*
 * Keep the credential-upgrade entry narrow: it only supplies the current
 * user and cancellation predicate. Claiming, presentation acknowledgement,
 * and release are centralized in showOneKeyIdLegacyOAuthBindDialog so every
 * optional reminder uses the same cross-surface protocol.
 */
export async function showOneKeyIdLegacyOAuthBindDialogAfterCredentialUpgrade({
  onekeyUserId,
  shouldSkip,
}: {
  onekeyUserId: string | undefined;
  shouldSkip?: () => boolean;
}) {
  if (!onekeyUserId) {
    return false;
  }

  for (
    let attempt = 0;
    attempt < CREDENTIAL_UPGRADE_PROMPT_MAX_ATTEMPTS;
    attempt += 1
  ) {
    if (shouldSkip?.()) {
      return false;
    }
    const result = await showOneKeyIdLegacyOAuthBindDialog({
      type: 'credential-upgrade',
      onekeyUserId,
      shouldSkipBeforeShow: shouldSkip,
    });
    if (result !== 'retryable') {
      return result;
    }
    if (attempt < CREDENTIAL_UPGRADE_PROMPT_MAX_ATTEMPTS - 1) {
      await timerUtils.wait(
        CREDENTIAL_UPGRADE_PROMPT_RETRY_DELAY_MS * (attempt + 1),
      );
    }
  }
  return false;
}
