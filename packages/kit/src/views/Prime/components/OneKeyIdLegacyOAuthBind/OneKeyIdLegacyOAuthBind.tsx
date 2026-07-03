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
  EOneKeyIdLogoutDialogSource,
  useShowOneKeyIdLogoutDialog,
} from '@onekeyhq/kit/src/components/OneKeyAuth/OneKeyIdLogoutDialog';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import {
  EOneKeyIdLoginWithLocalKeylessPrepareStatus,
  type IOneKeyIdLoginWithLocalKeylessPrepareResult,
} from '@onekeyhq/shared/src/keylessWallet/keylessWalletTypes';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import {
  EOneKeyIdIdentityType,
  EOneKeyIdOAuthProvider,
  type IOneKeyIdAccount,
} from '@onekeyhq/shared/types/prime/primeTypes';

import { useOneKeyIdLocalKeylessOAuth } from '../useOneKeyIdLocalKeylessOAuth';

export const ONEKEY_ID_BIND_OAUTH_TITLE = 'Add Google or Apple Sign-In';
export const ONEKEY_ID_BIND_OAUTH_DESC =
  'Email sign-in is legacy. Add a social sign-in method to keep access to your OneKey ID.';
let isLegacyOAuthBindDialogVisible = false;

const ONEKEY_ID_OAUTH_PROVIDER_ORDER = [
  EOneKeyIdOAuthProvider.Google,
  EOneKeyIdOAuthProvider.Apple,
];

function getOAuthProviderName(provider: EOAuthSocialLoginProvider) {
  return provider === EOAuthSocialLoginProvider.Google ? 'Google' : 'Apple';
}

function getOneKeyIdOAuthProviderName(provider: EOneKeyIdOAuthProvider) {
  return provider === EOneKeyIdOAuthProvider.Google ? 'Google' : 'Apple';
}

function getOneKeyIdOAuthProviderIcon(provider: EOneKeyIdOAuthProvider) {
  return provider === EOneKeyIdOAuthProvider.Google
    ? 'GoogleIllus'
    : 'AppleBrand';
}

function getBoundOAuthProviders(onekeyAccount?: IOneKeyIdAccount) {
  const providerSet = new Set<EOneKeyIdOAuthProvider>();
  onekeyAccount?.identities?.forEach((identity) => {
    if (
      identity.identityType === EOneKeyIdIdentityType.OAuth &&
      identity.oauthProvider
    ) {
      providerSet.add(identity.oauthProvider);
    }
  });
  return ONEKEY_ID_OAUTH_PROVIDER_ORDER.filter((provider) =>
    providerSet.has(provider),
  );
}

function isOneKeyIdAccountMissingOAuthIdentity(
  onekeyAccount?: IOneKeyIdAccount,
) {
  const identities = onekeyAccount?.identities ?? [];
  const hasLegacyEmailIdentity = identities.some(
    (identity) => identity.identityType === EOneKeyIdIdentityType.LegacyEmail,
  );
  const hasOAuthIdentity = identities.some(
    (identity) => identity.identityType === EOneKeyIdIdentityType.OAuth,
  );
  return hasLegacyEmailIdentity && !hasOAuthIdentity;
}

function getBindOAuthTitle(provider?: EOAuthSocialLoginProvider) {
  return provider
    ? `Add ${getOAuthProviderName(provider)} Sign-In`
    : ONEKEY_ID_BIND_OAUTH_TITLE;
}

function getBindOAuthDescription(provider?: EOAuthSocialLoginProvider) {
  return provider
    ? `Email sign-in is legacy. Add ${getOAuthProviderName(
        provider,
      )} sign-in method to keep access to your OneKey ID.`
    : ONEKEY_ID_BIND_OAUTH_DESC;
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
  onBeforeShowKeylessLogoutDialog,
}: {
  bindProvider?: EOAuthSocialLoginProvider;
  buttonSize?: 'small' | 'large';
  fullWidth?: boolean;
  onBindSuccess?: () => void | Promise<void>;
  onBindError?: (error: unknown) => void;
  onBeforeShowKeylessLogoutDialog?: () => void | Promise<void>;
}) {
  const intl = useIntl();
  const { legacySupabaseSignOut } = useOneKeyAuth();
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
    const prepareLocalKeylessLogin = async () => {
      try {
        const result =
          await backgroundApiProxy.serviceKeylessWallet.prepareOneKeyIdLoginWithLocalKeyless();
        if (isMounted) {
          setLocalKeylessLoginPrepareResult(result);
        }
      } catch {
        if (isMounted) {
          setLocalKeylessLoginPrepareResult({
            status: EOneKeyIdLoginWithLocalKeylessPrepareStatus.NoLocalKeyless,
          });
        }
      }
    };

    void prepareLocalKeylessLogin();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleBindOAuth = useCallback(
    async (provider: EOAuthSocialLoginProvider) => {
      if (bindingProviderRef.current) {
        return;
      }
      bindingProviderRef.current = provider;
      setBindingProvider(provider);
      try {
        setShowKeylessLogoutAction(false);
        await errorToastUtils.withErrorAutoToast(async () => {
          let didUseOAuthSignIn = false;
          try {
            const result = await getOAuthAccessToken({
              provider,
              missingTokenMessage: 'OAuth bind failed: access token not found',
            });
            didUseOAuthSignIn = result.didUseOAuthSignIn;
            await backgroundApiProxy.servicePrime.apiBindLegacyOneKeyIdOAuth({
              oauthAccessToken: result.accessToken,
            });
          } catch (error) {
            if (didUseOAuthSignIn) {
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
      intl,
      legacySupabaseSignOut,
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

    await onBeforeShowKeylessLogoutDialog?.();
    await timerUtils.wait(300);
    void showOneKeyIdLogoutDialog({
      source: EOneKeyIdLogoutDialogSource.KeylessWallet,
      keylessWallet,
      isOneKeyIdLoggedIn: false,
    });
  }, [onBeforeShowKeylessLogoutDialog, showOneKeyIdLogoutDialog]);

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
  onBeforeShowKeylessLogoutDialog,
}: {
  bindProvider?: EOAuthSocialLoginProvider;
  onBindSuccess?: () => void | Promise<void>;
  onBindError?: (error: unknown) => void;
  onBeforeShowKeylessLogoutDialog?: () => void | Promise<void>;
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
        onBeforeShowKeylessLogoutDialog={onBeforeShowKeylessLogoutDialog}
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
    () => isOneKeyIdAccountMissingOAuthIdentity(onekeyAccount),
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
  onDialogShow,
  shouldSkipBeforeShow,
  checkBindRequired = true,
}: {
  bindProvider?: EOAuthSocialLoginProvider;
  onBindSuccess?: () => void | Promise<void>;
  onDialogShow?: () => void | Promise<void>;
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
            onBeforeShowKeylessLogoutDialog={async () => {
              if (!isSettled) {
                isSettled = true;
                await dialog.close();
                resolve(false);
              }
            }}
          />
        ),
      });
      void Promise.resolve(onDialogShow?.()).catch((error) => {
        console.error(
          'showOneKeyIdLegacyOAuthBindDialog onDialogShow failed:',
          error,
        );
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

  const hasShown =
    await backgroundApiProxy.simpleDb.prime.hasShownLocalKeylessUpgradeBindPrompt(
      {
        onekeyUserId,
      },
    );
  if (hasShown) {
    return false;
  }
  if (shouldSkip?.()) {
    return false;
  }

  let hasLocalKeylessWallet = false;
  try {
    const result =
      await backgroundApiProxy.serviceKeylessWallet.prepareOneKeyIdLoginWithLocalKeyless();
    hasLocalKeylessWallet =
      result.status !==
      EOneKeyIdLoginWithLocalKeylessPrepareStatus.NoLocalKeyless;
  } catch (error) {
    console.error(
      'showOneKeyIdLegacyOAuthBindDialogForLocalKeylessUpgrade failed:',
      error,
    );
  }

  if (!hasLocalKeylessWallet || shouldSkip?.()) {
    return false;
  }

  let bindRequired = false;
  try {
    bindRequired =
      await backgroundApiProxy.servicePrime.isLegacyOneKeyIdOAuthBindRequired();
  } catch (error) {
    console.error(
      'showOneKeyIdLegacyOAuthBindDialogForLocalKeylessUpgrade bind required check failed:',
      error,
    );
    return false;
  }
  if (!bindRequired) {
    return false;
  }
  if (shouldSkip?.()) {
    return false;
  }

  // This is the only passive restore path that may auto-show the bind dialog:
  // legacy OneKey ID is still email-only while a local Keyless wallet already
  // exists from the old version.
  return showOneKeyIdLegacyOAuthBindDialog({
    checkBindRequired: false,
    shouldSkipBeforeShow: shouldSkip,
    onDialogShow: async () => {
      await backgroundApiProxy.simpleDb.prime.markLocalKeylessUpgradeBindPromptShown(
        {
          onekeyUserId,
        },
      );
    },
  });
}
