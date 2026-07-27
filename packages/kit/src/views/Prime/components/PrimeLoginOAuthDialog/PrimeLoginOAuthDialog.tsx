import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Accordion,
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
import {
  redirectOneKeyIdAuthToExtExpandTab,
  shouldRunOneKeyIdAuthInExtExpandTab,
} from '@onekeyhq/kit/src/components/OneKeyAuth/extOneKeyIdAuthExpandTab';
import { useIdentityExitFlow } from '@onekeyhq/kit/src/components/OneKeyAuth/useIdentityExitFlow';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import {
  EExtOneKeyIdAuthFlow,
  EOAuthSocialLoginProvider,
} from '@onekeyhq/shared/src/consts/authConsts';
import {
  OneKeyLocalError,
  PrimeLoginDialogCancelError,
} from '@onekeyhq/shared/src/errors';
import type { IOneKeyIdLoginWithLocalKeylessPrepareResult } from '@onekeyhq/shared/src/keylessWallet/keylessWalletTypes';
import {
  ELocalKeylessWalletOAuthState,
  EOneKeyIdLoginWithLocalKeylessPrepareStatus,
} from '@onekeyhq/shared/src/keylessWallet/keylessWalletTypes';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { shouldClearKeylessOAuthSessionAfterError } from '@onekeyhq/shared/src/utils/keylessOAuthSessionUtils';
import type {
  IIdentityExitOAuthHandoff,
  IKeylessOAuthSessionRollbackHandle,
} from '@onekeyhq/shared/types/prime/identityExitTypes';

import {
  showOneKeyIdLoginFailedToast,
  showOneKeyIdLoginSuccessToast,
} from '../oneKeyIdLoginToastUtils';
import {
  type IOneKeyIdLocalKeylessOAuthContext,
  useOneKeyIdLocalKeylessOAuth,
} from '../useOneKeyIdLocalKeylessOAuth';

import {
  type IOneKeyIdLoginMethod,
  getOneKeyIdLoginMethodGroups,
} from './oneKeyIdLoginMethods';
function PrimeLoginOAuthDialog(props: {
  onComplete: () => Promise<void>;
  onLoginSuccess?: () => void | Promise<void>;
  onCancel?: () => void | Promise<void>;
  localKeylessLoginPrepareResult?: IOneKeyIdLoginWithLocalKeylessPrepareResult;
  localKeylessLoginPrepareErrorMessage?: string;
  toOneKeyIdPageOnLoginSuccess?: boolean;
}) {
  const {
    onComplete,
    onLoginSuccess,
    onCancel,
    localKeylessLoginPrepareResult,
    localKeylessLoginPrepareErrorMessage,
    toOneKeyIdPageOnLoginSuccess,
  } = props;
  const intl = useIntl();
  const { loginOneKeyIdWithLegacyEmail } = useOneKeyAuth();
  const { run: runIdentityExit } = useIdentityExitFlow();
  const [loggingInProvider, setLoggingInProvider] =
    useState<EOAuthSocialLoginProvider | null>(null);
  const [isEmailLoginStarting, setIsEmailLoginStarting] = useState(false);
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [showKeylessLogoutAction, setShowKeylessLogoutAction] = useState(false);
  const loggingInProviderRef = useRef<EOAuthSocialLoginProvider | null>(null);
  const isEmailLoginStartingRef = useRef(false);
  loggingInProviderRef.current = loggingInProvider;
  const handleAccountMismatch = useCallback(() => {
    setShowKeylessLogoutAction(true);
  }, []);
  const {
    localKeylessProvider,
    localKeylessWalletId,
    localKeylessProviderName,
    isLocalKeylessOAuthMode,
    getOAuthAccessToken,
    getFreshOAuthTokensForRegularLogin,
    rollbackProvisionalOAuthSession,
  } = useOneKeyIdLocalKeylessOAuth({
    localKeylessLoginPrepareResult,
    onAccountMismatch: handleAccountMismatch,
    forceAccountMismatchToast: true,
  });
  const loginMethodGroups = getOneKeyIdLoginMethodGroups({
    isLocalKeylessOAuthMode,
    isLocalKeylessDataUnavailable:
      localKeylessLoginPrepareResult?.status ===
      EOneKeyIdLoginWithLocalKeylessPrepareStatus.LocalKeylessDataUnavailable,
    localKeylessProvider,
  });
  const isLoginBusy = Boolean(loggingInProvider) || isEmailLoginStarting;

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
      await onComplete();
      void onCancel?.();
    })();
  }, [
    onCancel,
    onComplete,
    shouldRedirectToExtExpandTab,
    toOneKeyIdPageOnLoginSuccess,
  ]);

  const performOAuthLogin = useCallback(
    async ({
      provider,
      useRegularOAuthLogin,
      closeDialogOnSuccess,
      identityExitOAuthHandoff,
      localKeylessContext,
    }: {
      provider: EOAuthSocialLoginProvider;
      useRegularOAuthLogin: boolean;
      closeDialogOnSuccess: boolean;
      identityExitOAuthHandoff?: IIdentityExitOAuthHandoff;
      localKeylessContext?: IOneKeyIdLocalKeylessOAuthContext;
    }) => {
      let isOneKeyIdLoginCommitted = false;
      let didUseOAuthSignIn = false;
      let rollbackHandle: IKeylessOAuthSessionRollbackHandle | undefined;
      try {
        let accessToken = '';
        let refreshToken = '';
        if (useRegularOAuthLogin) {
          const result = await getFreshOAuthTokensForRegularLogin({
            provider,
            // TODO: i18n
            missingTokenMessage: 'OAuth login failed: access token not found',
          });
          accessToken = result.accessToken;
          refreshToken = result.refreshToken;
        } else {
          const result = await getOAuthAccessToken({
            provider,
            // TODO: i18n
            missingTokenMessage: 'OAuth login failed: access token not found',
            localKeylessContext,
          });
          accessToken = result.accessToken;
          didUseOAuthSignIn = result.didUseOAuthSignIn;
          rollbackHandle = result.rollbackHandle;
        }
        try {
          if (useRegularOAuthLogin) {
            await backgroundApiProxy.servicePrime.apiOAuthLoginWithFreshSessionForLoggedOutState(
              {
                accessToken,
                refreshToken,
                ...(identityExitOAuthHandoff
                  ? { identityExitOAuthHandoff, provider }
                  : {}),
              },
            );
          } else {
            await backgroundApiProxy.servicePrime.apiOAuthLogin({
              accessToken,
            });
          }
          isOneKeyIdLoginCommitted = true;
        } catch (error) {
          if (
            !useRegularOAuthLogin &&
            shouldClearKeylessOAuthSessionAfterError(error)
          ) {
            if (didUseOAuthSignIn && rollbackHandle) {
              await rollbackProvisionalOAuthSession({ rollbackHandle });
            }
          }
          throw error;
        }
        showOneKeyIdLoginSuccessToast(intl);
        if (closeDialogOnSuccess) {
          await onComplete();
        }
        await onLoginSuccess?.();
      } catch (error) {
        if (!isOneKeyIdLoginCommitted) {
          showOneKeyIdLoginFailedToast({ error, intl });
        }
        throw error;
      }
    },
    [
      getFreshOAuthTokensForRegularLogin,
      getOAuthAccessToken,
      intl,
      onComplete,
      onLoginSuccess,
      rollbackProvisionalOAuthSession,
    ],
  );

  const handleSocialLogin = useCallback(
    async (provider: EOAuthSocialLoginProvider) => {
      if (loggingInProviderRef.current || isEmailLoginStartingRef.current) {
        return;
      }
      loggingInProviderRef.current = provider;
      try {
        setShowKeylessLogoutAction(false);
        setLoggingInProvider(provider);
        await performOAuthLogin({
          provider,
          useRegularOAuthLogin: false,
          closeDialogOnSuccess: true,
        });
      } finally {
        loggingInProviderRef.current = null;
        setLoggingInProvider(null);
      }
    },
    [performOAuthLogin],
  );

  const handleSwitchOAuthProvider = useCallback(
    async (
      provider: EOAuthSocialLoginProvider,
      options?: {
        expectedWalletId?: string;
        reuseBusyLock?: boolean;
      },
    ) => {
      const expectedWalletId =
        options?.expectedWalletId ?? localKeylessWalletId;
      if (
        (loggingInProviderRef.current && !options?.reuseBusyLock) ||
        isEmailLoginStartingRef.current ||
        !expectedWalletId
      ) {
        return;
      }
      loggingInProviderRef.current = provider;
      let didCloseDialogForNextStep = false;
      let didCompleteOAuthContinuation = false;
      try {
        setShowKeylessLogoutAction(false);
        setLoggingInProvider(provider);
        const result = await runIdentityExit(
          {
            type: 'switchOAuth',
            expectedWalletId,
            nextProvider: provider,
            scene: 'oneKeyIdLogin',
          },
          {
            confirmButtonTestID:
              'prime-login-switch-oauth-logout-keyless-wallet-confirm-btn',
            beforePresentReadyPlan: async () => {
              try {
                await onComplete();
                didCloseDialogForNextStep = true;
              } catch (error) {
                await onCancel?.();
                throw error;
              }
            },
            onCompletedReceipt: async (receipt) => {
              const continuation = receipt.startIndependentOneKeyIdOAuth;
              if (!continuation || continuation.provider !== provider) {
                // TODO: i18n
                throw new OneKeyLocalError(
                  'OAuth provider-switch continuation is unavailable.',
                );
              }
              await backgroundApiProxy.serviceIdentityExit.validateOAuthHandoffBeforeLaunch(
                {
                  handoff: continuation.handoff,
                  provider,
                },
              );
              await performOAuthLogin({
                provider,
                useRegularOAuthLogin: true,
                closeDialogOnSuccess: false,
                identityExitOAuthHandoff: continuation.handoff,
              });
              didCompleteOAuthContinuation = true;
            },
          },
        );
        if (
          didCloseDialogForNextStep &&
          (result.status !== 'completed' || !didCompleteOAuthContinuation)
        ) {
          await onCancel?.();
        }
      } finally {
        loggingInProviderRef.current = null;
        if (!didCloseDialogForNextStep) {
          setLoggingInProvider(null);
        }
      }
    },
    [
      localKeylessWalletId,
      onCancel,
      onComplete,
      performOAuthLogin,
      runIdentityExit,
    ],
  );

  const handleMalformedKeylessOAuth = useCallback(
    async (provider: EOAuthSocialLoginProvider) => {
      if (loggingInProviderRef.current || isEmailLoginStartingRef.current) {
        return;
      }
      loggingInProviderRef.current = provider;
      setShowKeylessLogoutAction(false);
      setLoggingInProvider(provider);

      let inspection;
      try {
        inspection =
          await backgroundApiProxy.serviceKeylessWallet.inspectLocalKeylessWalletForOAuth();
      } catch (error) {
        Toast.error({
          // TODO: i18n
          title: 'Unable to read Keyless wallet data',
          message:
            (error instanceof Error && error.message) ||
            localKeylessLoginPrepareResult?.errorMessage ||
            localKeylessLoginPrepareErrorMessage ||
            'Unknown Keyless wallet data read error',
        });
        loggingInProviderRef.current = null;
        setLoggingInProvider(null);
        return;
      }

      if (inspection.status === ELocalKeylessWalletOAuthState.Absent) {
        try {
          await performOAuthLogin({
            provider,
            useRegularOAuthLogin: true,
            closeDialogOnSuccess: true,
          });
        } finally {
          loggingInProviderRef.current = null;
          setLoggingInProvider(null);
        }
        return;
      }

      if (inspection.status === ELocalKeylessWalletOAuthState.Ready) {
        if (inspection.provider !== provider) {
          await handleSwitchOAuthProvider(provider, {
            expectedWalletId: inspection.walletId,
            reuseBusyLock: true,
          });
          return;
        }
        try {
          await performOAuthLogin({
            provider,
            useRegularOAuthLogin: false,
            closeDialogOnSuccess: true,
            localKeylessContext: {
              provider: inspection.provider,
              walletId: inspection.walletId,
            },
          });
        } finally {
          loggingInProviderRef.current = null;
          setLoggingInProvider(null);
        }
        return;
      }

      let didCloseDialogForNextStep = false;
      let didCompleteOAuthContinuation = false;
      try {
        const result = await runIdentityExit(
          {
            type: 'recoverMalformedKeyless',
            expectedWalletId: inspection.walletId,
            nextProvider: provider,
            scene: 'oneKeyIdLogin',
          },
          {
            confirmButtonTestID:
              'prime-login-recover-keyless-wallet-confirm-btn',
            beforePresentReadyPlan: async () => {
              try {
                await onComplete();
                didCloseDialogForNextStep = true;
              } catch (error) {
                await onCancel?.();
                throw error;
              }
            },
            onCompletedReceipt: async (receipt) => {
              const continuation = receipt.startIndependentOneKeyIdOAuth;
              if (!continuation || continuation.provider !== provider) {
                // TODO: i18n
                throw new OneKeyLocalError(
                  'OAuth continuation after Keyless recovery is unavailable.',
                );
              }
              await backgroundApiProxy.serviceIdentityExit.validateOAuthHandoffBeforeLaunch(
                { handoff: continuation.handoff, provider },
              );
              await performOAuthLogin({
                provider,
                useRegularOAuthLogin: true,
                closeDialogOnSuccess: false,
                identityExitOAuthHandoff: continuation.handoff,
              });
              didCompleteOAuthContinuation = true;
            },
          },
        );
        if (
          didCloseDialogForNextStep &&
          (result.status !== 'completed' || !didCompleteOAuthContinuation)
        ) {
          await onCancel?.();
        }
      } finally {
        loggingInProviderRef.current = null;
        if (!didCloseDialogForNextStep) {
          setLoggingInProvider(null);
        }
      }
    },
    [
      handleSwitchOAuthProvider,
      localKeylessLoginPrepareResult?.errorMessage,
      localKeylessLoginPrepareErrorMessage,
      onCancel,
      onComplete,
      performOAuthLogin,
      runIdentityExit,
    ],
  );

  const handleLogoutKeylessWallet = useCallback(async () => {
    if (
      loggingInProviderRef.current ||
      isEmailLoginStartingRef.current ||
      !localKeylessWalletId
    ) {
      return;
    }
    let didCloseDialogForNextStep = false;
    await runIdentityExit(
      {
        type: 'removeKeyless',
        expectedWalletId: localKeylessWalletId,
        scene: 'oneKeyIdLogin',
      },
      {
        beforePresentReadyPlan: async () => {
          try {
            await onComplete();
            didCloseDialogForNextStep = true;
          } catch (error) {
            await onCancel?.();
            throw error;
          }
        },
      },
    );
    if (didCloseDialogForNextStep) {
      await onCancel?.();
    }
  }, [localKeylessWalletId, onCancel, onComplete, runIdentityExit]);

  const toggleAuthMode = useCallback(() => {
    if (loggingInProviderRef.current || isEmailLoginStartingRef.current) {
      return;
    }
    setIsSignUpMode((prev) => !prev);
  }, []);

  const handleEmailLogin = useCallback(async () => {
    if (loggingInProviderRef.current || isEmailLoginStartingRef.current) {
      return;
    }
    isEmailLoginStartingRef.current = true;
    setIsEmailLoginStarting(true);
    let isOneKeyIdLoginCommitted = false;
    let didCloseDialogForNextStep = false;
    try {
      await onComplete();
      didCloseDialogForNextStep = true;
      await loginOneKeyIdWithLegacyEmail({
        isSignUpMode,
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
    } finally {
      isEmailLoginStartingRef.current = false;
      if (!didCloseDialogForNextStep) {
        setIsEmailLoginStarting(false);
      }
    }
  }, [
    intl,
    loginOneKeyIdWithLegacyEmail,
    onCancel,
    onComplete,
    onLoginSuccess,
    isSignUpMode,
  ]);

  const renderLoginMethod = (method: IOneKeyIdLoginMethod) => {
    if (method.type === 'email') {
      return (
        <Button
          key="email"
          size="large"
          icon="EmailOutline"
          testID="prime-login-email-btn"
          disabled={isLoginBusy}
          loading={isEmailLoginStarting}
          onPress={() => void handleEmailLogin()}
        >
          {/* TODO: i18n (add a dedicated Continue with Email action) */}
          {intl.formatMessage(
            { id: ETranslations.continue_with_social_platform },
            { platform: 'Email' },
          )}
        </Button>
      );
    }

    const providerName =
      method.provider === EOAuthSocialLoginProvider.Google ? 'Google' : 'Apple';
    const handleOAuthPress = () => {
      if (method.requiresMalformedKeylessRecovery) {
        void handleMalformedKeylessOAuth(method.provider);
        return;
      }
      if (method.requiresKeylessLogout) {
        void handleSwitchOAuthProvider(method.provider);
        return;
      }
      void handleSocialLogin(method.provider);
    };
    return (
      <Button
        key={method.provider}
        size="large"
        icon={
          method.provider === EOAuthSocialLoginProvider.Google
            ? 'GoogleIllus'
            : 'AppleBrand'
        }
        testID={`prime-login-oauth-${method.provider}-btn`}
        disabled={isLoginBusy}
        loading={loggingInProvider === method.provider}
        onPress={handleOAuthPress}
      >
        {intl.formatMessage(
          { id: ETranslations.continue_with_social_platform },
          { platform: providerName },
        )}
      </Button>
    );
  };

  if (shouldRedirectToExtExpandTab) {
    // Render nothing while the expand-tab handoff closes this dialog.
    return null;
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
        {loginMethodGroups.primary.map(renderLoginMethod)}
        {isLocalKeylessOAuthMode && localKeylessProvider ? (
          <SizableText size="$bodySm" color="$textSubdued" ta="center">
            {/* TODO: i18n (use a {provider} placeholder) */}
            {`Use the ${localKeylessProviderName} account linked to your Keyless wallet.`}
          </SizableText>
        ) : null}
        <Accordion type="single" collapsible defaultValue="">
          <Accordion.Item value="more-login-methods">
            <Accordion.Trigger
              unstyled
              testID="prime-login-more-methods-trigger"
              disabled={isLoginBusy}
              alignSelf="center"
              minHeight={44}
              px="$1"
              py="$2"
              borderWidth={0}
              bg="$transparent"
              flexDirection="row"
              alignItems="center"
              justifyContent="center"
              gap="$1"
              cursor="pointer"
              hoverStyle={{ opacity: 0.8 }}
              pressStyle={{ opacity: 0.7 }}
              focusVisibleStyle={{
                outlineColor: '$focusRing',
                outlineStyle: 'solid',
                outlineWidth: 2,
              }}
            >
              {({ open }: { open: boolean }) => (
                <>
                  <SizableText
                    size="$bodyMdMedium"
                    color="$textSubdued"
                    textAlign="center"
                  >
                    {/* TODO: i18n */}
                    More Sign-In Methods
                  </SizableText>
                  <Stack animation="quick" rotate={open ? '180deg' : '0deg'}>
                    <Icon
                      name="ChevronDownSmallOutline"
                      size="$4"
                      color="$iconSubdued"
                    />
                  </Stack>
                </>
              )}
            </Accordion.Trigger>
            <Accordion.HeightAnimator animation="quick" overflow="hidden">
              <Accordion.Content
                unstyled
                testID="prime-login-more-methods-content"
                p={0}
                pt="$3"
              >
                <YStack gap="$3">
                  {loginMethodGroups.more.map(renderLoginMethod)}
                </YStack>
              </Accordion.Content>
            </Accordion.HeightAnimator>
          </Accordion.Item>
        </Accordion>
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
              disabled={isLoginBusy}
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
            </XStack>
          </YStack>
        }
      />
    </Stack>
  );
}

export default PrimeLoginOAuthDialog;
