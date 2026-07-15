import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  IconButton,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  redirectOneKeyIdAuthToExtExpandTab,
  shouldRunOneKeyIdAuthInExtExpandTab,
} from '@onekeyhq/kit/src/components/OneKeyAuth/extOneKeyIdAuthExpandTab';
import {
  EOneKeyIdLogoutDialogSource,
  useShowOneKeyIdLogoutDialog,
} from '@onekeyhq/kit/src/components/OneKeyAuth/OneKeyIdLogoutDialog';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import {
  EExtOneKeyIdAuthFlow,
  EOAuthSocialLoginProvider,
} from '@onekeyhq/shared/src/consts/authConsts';
import { PrimeLoginDialogCancelError } from '@onekeyhq/shared/src/errors';
import type { IOneKeyIdLoginWithLocalKeylessPrepareResult } from '@onekeyhq/shared/src/keylessWallet/keylessWalletTypes';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { isTransientNetworkLikeError } from '@onekeyhq/shared/src/utils/transientNetworkErrorUtils';

import {
  showOneKeyIdLoginFailedToast,
  showOneKeyIdLoginSuccessToast,
} from '../oneKeyIdLoginToastUtils';
import { useOneKeyIdLocalKeylessOAuth } from '../useOneKeyIdLocalKeylessOAuth';

function PrimeLoginOAuthDialog(props: {
  onComplete: () => void;
  onLoginSuccess?: () => void | Promise<void>;
  onCancel?: () => void | Promise<void>;
  localKeylessLoginPrepareResult?: IOneKeyIdLoginWithLocalKeylessPrepareResult;
  toOneKeyIdPageOnLoginSuccess?: boolean;
}) {
  const {
    onComplete,
    onLoginSuccess,
    onCancel,
    localKeylessLoginPrepareResult,
    toOneKeyIdPageOnLoginSuccess,
  } = props;
  const intl = useIntl();
  const { loginOneKeyIdWithLegacyEmail, supabaseSignOut } = useOneKeyAuth();
  const showOneKeyIdLogoutDialog = useShowOneKeyIdLogoutDialog();
  const [loggingInProvider, setLoggingInProvider] =
    useState<EOAuthSocialLoginProvider | null>(null);
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [isLegacyEmailConfirmMode, setIsLegacyEmailConfirmMode] =
    useState(false);
  const [showKeylessLogoutAction, setShowKeylessLogoutAction] = useState(false);
  const loggingInProviderRef = useRef<EOAuthSocialLoginProvider | null>(null);
  loggingInProviderRef.current = loggingInProvider;
  const handleAccountMismatch = useCallback(() => {
    setShowKeylessLogoutAction(true);
  }, []);
  const {
    localKeylessProvider,
    localKeylessProviderName,
    isLocalKeylessOAuthMode,
    shouldShowProvider,
    getOAuthAccessToken,
    clearOAuthSignInTempSession,
  } = useOneKeyIdLocalKeylessOAuth({
    localKeylessLoginPrepareResult,
    onAccountMismatch: handleAccountMismatch,
    forceAccountMismatchToast: true,
  });
  const shouldShowGoogleButton = shouldShowProvider(
    EOAuthSocialLoginProvider.Google,
  );
  const shouldShowAppleButton = shouldShowProvider(
    EOAuthSocialLoginProvider.Apple,
  );

  // Fallback guard: the showOneKeyIdLoginDialog funnel already redirects the
  // ext action popup to the expand tab, but this dialog can also be rendered
  // directly. launchWebAuthFlow can never complete in the action popup
  // (Chrome destroys it on focus loss), so hand the flow off to the expand
  // tab on mount instead of showing the buttons.
  const shouldRedirectToExtExpandTab = shouldRunOneKeyIdAuthInExtExpandTab();
  const hasRedirectedToExtExpandTabRef = useRef(false);
  useEffect(() => {
    if (
      !shouldRedirectToExtExpandTab ||
      hasRedirectedToExtExpandTabRef.current
    ) {
      return;
    }
    hasRedirectedToExtExpandTabRef.current = true;
    void (async () => {
      await redirectOneKeyIdAuthToExtExpandTab({
        flow: EExtOneKeyIdAuthFlow.Login,
        toOneKeyIdPageOnLoginSuccess,
      });
      onComplete?.();
      void onCancel?.();
    })();
  }, [
    onCancel,
    onComplete,
    shouldRedirectToExtExpandTab,
    toOneKeyIdPageOnLoginSuccess,
  ]);

  const handleSocialLogin = useCallback(
    async (provider: EOAuthSocialLoginProvider) => {
      if (loggingInProviderRef.current) {
        return;
      }
      loggingInProviderRef.current = provider;
      let isOneKeyIdLoginCommitted = false;
      let didUseOAuthSignIn = false;
      try {
        setShowKeylessLogoutAction(false);
        setLoggingInProvider(provider);
        const result = await getOAuthAccessToken({
          provider,
          missingTokenMessage: 'OAuth login failed: access token not found',
        });
        didUseOAuthSignIn = result.didUseOAuthSignIn;
        try {
          await backgroundApiProxy.servicePrime.apiOAuthLogin({
            accessToken: result.accessToken,
          });
          isOneKeyIdLoginCommitted = true;
        } catch (error) {
          // Only tear the session down on definitive rejections: a transient
          // network failure (timeout / 5xx) says nothing about the
          // just-validated session, and keeping it lets the retry skip a
          // fresh Google/Apple OAuth round-trip (same policy as
          // startKeylessCreateWithOAuthProvider).
          if (!isTransientNetworkLikeError(error)) {
            if (didUseOAuthSignIn && isLocalKeylessOAuthMode) {
              await clearOAuthSignInTempSession();
            } else if (didUseOAuthSignIn) {
              await supabaseSignOut();
              await backgroundApiProxy.simpleDb.prime.clearLocalAuthSession();
            }
          }
          throw error;
        }
        showOneKeyIdLoginSuccessToast(intl);
        onComplete?.();
        await onLoginSuccess?.();
      } catch (error) {
        if (!isOneKeyIdLoginCommitted) {
          showOneKeyIdLoginFailedToast({ error, intl });
        }
        throw error;
      } finally {
        loggingInProviderRef.current = null;
        setLoggingInProvider(null);
      }
    },
    [
      clearOAuthSignInTempSession,
      getOAuthAccessToken,
      intl,
      isLocalKeylessOAuthMode,
      onComplete,
      onLoginSuccess,
      supabaseSignOut,
    ],
  );

  const handleLogoutKeylessWallet = useCallback(async () => {
    if (loggingInProviderRef.current) {
      return;
    }
    const keylessWallet =
      await backgroundApiProxy.serviceAccount.getKeylessWallet();
    if (!keylessWallet) {
      return;
    }

    onComplete?.();
    await timerUtils.wait(300);
    void showOneKeyIdLogoutDialog({
      source: EOneKeyIdLogoutDialogSource.KeylessWallet,
      keylessWallet,
      isOneKeyIdLoggedIn: false,
    });
    void onCancel?.();
  }, [onCancel, onComplete, showOneKeyIdLogoutDialog]);

  const handleProviderButtonPress = useCallback(
    (provider: EOAuthSocialLoginProvider) => {
      void handleSocialLogin(provider);
    },
    [handleSocialLogin],
  );

  const toggleAuthMode = useCallback(() => {
    if (loggingInProviderRef.current) {
      return;
    }
    setIsSignUpMode((prev) => !prev);
  }, []);

  const handleLegacyEmailLogin = useCallback(async () => {
    if (loggingInProviderRef.current) {
      return;
    }
    let isOneKeyIdLoginCommitted = false;
    try {
      onComplete?.();
      await timerUtils.wait(300);
      await loginOneKeyIdWithLegacyEmail({
        preserveLocalKeylessAuth: isLocalKeylessOAuthMode,
      });
      isOneKeyIdLoginCommitted = true;
      await onLoginSuccess?.();
    } catch (error) {
      if (error instanceof PrimeLoginDialogCancelError) {
        await onCancel?.();
        return;
      }
      // The OAuth dialog was already closed via onComplete above, so a
      // non-cancel failure (e.g. a bridge error before the email dialog
      // shows) leaves no dialog on screen. The outer
      // showOneKeyIdLoginDialog promise only exposes onLoginSuccess/onCancel
      // (no reject-with-original-error callback), so surface the failure
      // with a toast and settle through the cancel path; otherwise callers
      // awaiting loginOneKeyId() would hang forever.
      if (!isOneKeyIdLoginCommitted) {
        showOneKeyIdLoginFailedToast({ error, intl });
      }
      await onCancel?.();
    }
  }, [
    intl,
    isLocalKeylessOAuthMode,
    loginOneKeyIdWithLegacyEmail,
    onCancel,
    onComplete,
    onLoginSuccess,
  ]);

  const showLegacyEmailLoginConfirm = useCallback(() => {
    if (loggingInProviderRef.current) {
      return;
    }
    setIsLegacyEmailConfirmMode(true);
  }, []);

  const hideLegacyEmailLoginConfirm = useCallback(() => {
    setIsLegacyEmailConfirmMode(false);
  }, []);

  if (shouldRedirectToExtExpandTab) {
    // Render nothing while the expand-tab handoff closes this dialog.
    return null;
  }

  if (isLegacyEmailConfirmMode) {
    return (
      <Stack>
        <Dialog.Header>
          <Dialog.Icon icon="InfoCircleOutline" />
          <Dialog.Title>Use Email Sign In?</Dialog.Title>
          <Dialog.Description>
            Email sign in is only available for existing OneKey ID accounts that
            previously used email login. It does not support creating a new
            OneKey ID with email.
          </Dialog.Description>
        </Dialog.Header>
        <Dialog.Footer
          showCancelButton
          onCancelText={intl.formatMessage({
            id: ETranslations.global_cancel,
          })}
          onConfirmText={intl.formatMessage({
            id: ETranslations.global_continue,
          })}
          onCancel={hideLegacyEmailLoginConfirm}
          onConfirm={handleLegacyEmailLogin}
        />
      </Stack>
    );
  }

  return (
    <Stack>
      <Dialog.Header>
        <Dialog.Icon icon="OnekeyBrand" />
        <Dialog.Title>
          {intl.formatMessage({
            id: isSignUpMode
              ? ETranslations.prime_onekeyid_signup
              : ETranslations.prime_signup_login,
          })}
        </Dialog.Title>
        <Dialog.Description>
          {intl.formatMessage({
            id: ETranslations.prime_onekeyid_continue_description,
          })}
        </Dialog.Description>
      </Dialog.Header>
      <YStack gap="$3">
        {shouldShowGoogleButton ? (
          <Button
            size="large"
            icon="GoogleIllus"
            testID="prime-login-oauth-google-btn"
            disabled={Boolean(loggingInProvider)}
            loading={loggingInProvider === EOAuthSocialLoginProvider.Google}
            onPress={() =>
              handleProviderButtonPress(EOAuthSocialLoginProvider.Google)
            }
          >
            {intl.formatMessage(
              { id: ETranslations.continue_with_social_platform },
              { platform: 'Google' },
            )}
          </Button>
        ) : null}
        {shouldShowAppleButton ? (
          <Button
            size="large"
            icon="AppleBrand"
            testID="prime-login-oauth-apple-btn"
            disabled={Boolean(loggingInProvider)}
            loading={loggingInProvider === EOAuthSocialLoginProvider.Apple}
            onPress={() =>
              handleProviderButtonPress(EOAuthSocialLoginProvider.Apple)
            }
          >
            {intl.formatMessage(
              { id: ETranslations.continue_with_social_platform },
              { platform: 'Apple' },
            )}
          </Button>
        ) : null}
        {isLocalKeylessOAuthMode && localKeylessProvider ? (
          <SizableText size="$bodySm" color="$textSubdued" ta="center">
            {`Use the ${localKeylessProviderName} account linked to your Keyless Wallet.`}
          </SizableText>
        ) : null}
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
              testID="prime-login-oauth-logout-keyless-wallet-btn"
              disabled={Boolean(loggingInProvider)}
              onPress={handleLogoutKeylessWallet}
            >
              {intl.formatMessage({
                id: ETranslations.log_out_wallet,
              })}
            </Button>
          </YStack>
        ) : null}
      </YStack>
      <Dialog.Footer
        showFooter={false}
        extraContent={
          <YStack ai="center" px="$5" pb="$5">
            <XStack jc="center" ai="center">
              {isSignUpMode ? null : (
                <SizableText size="$bodyMd" color="$textSubdued">
                  {`${intl.formatMessage({
                    id: ETranslations.no_account,
                  })}?`}
                </SizableText>
              )}
              <SizableText
                size="$bodyMdMedium"
                color="$textInteractive"
                ml="$1"
                cursor="pointer"
                role="button"
                hoverStyle={{ opacity: 0.8 }}
                pressStyle={{ opacity: 0.7 }}
                onPress={toggleAuthMode}
              >
                {isSignUpMode
                  ? intl.formatMessage({
                      id: ETranslations.prime_signup_login,
                    })
                  : intl.formatMessage({
                      id: ETranslations.prime_onekeyid_signup,
                    })}
              </SizableText>
              {isSignUpMode ? null : (
                <IconButton
                  size="small"
                  variant="tertiary"
                  icon="InfoCircleOutline"
                  iconSize="$4"
                  title="Email sign in"
                  testID="prime-login-oauth-email-help-btn"
                  ml="$1"
                  onPress={showLegacyEmailLoginConfirm}
                />
              )}
            </XStack>
          </YStack>
        }
      />
    </Stack>
  );
}

export default PrimeLoginOAuthDialog;
