import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Accordion,
  Button,
  Dialog,
  HeightTransition,
  Icon,
  SizableText,
  Stack,
  Toast,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  redirectOneKeyIdAuthToExtExpandTab,
  shouldRunOneKeyIdAuthInExtExpandTab,
} from '@onekeyhq/kit/src/components/OneKeyAuth/extOneKeyIdAuthExpandTab';
import { useIdentityExitFlow } from '@onekeyhq/kit/src/components/OneKeyAuth/useIdentityExitFlow';
import {
  EExtOneKeyIdAuthFlow,
  EOAuthSocialLoginProvider,
} from '@onekeyhq/shared/src/consts/authConsts';
import type { IOneKeyIdLoginWithLocalKeylessPrepareResult } from '@onekeyhq/shared/src/keylessWallet/keylessWalletTypes';
import {
  ELocalKeylessWalletOAuthState,
  EOneKeyIdLoginWithLocalKeylessPrepareStatus,
} from '@onekeyhq/shared/src/keylessWallet/keylessWalletTypes';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { shouldClearKeylessOAuthSessionAfterError } from '@onekeyhq/shared/src/utils/keylessOAuthSessionUtils';
import type {
  IIdentityExitOAuthHandoff,
  IKeylessOAuthSessionRollbackHandle,
} from '@onekeyhq/shared/types/prime/identityExitTypes';

import {
  getSanitizedAuthErrorText,
  logOneKeyIdLoginFailureReason,
  scrubSensitiveErrorMessageText,
  showOneKeyIdLoginFailedToast,
  showOneKeyIdLoginSuccessToast,
  throwLocalizedOneKeyIdLoginError,
} from '../oneKeyIdLoginToastUtils';
import PrimeLoginEmailDialogV2 from '../PrimeLoginEmailDialogV2/PrimeLoginEmailDialogV2';
import {
  type IOneKeyIdLocalKeylessOAuthContext,
  useOneKeyIdLocalKeylessOAuth,
} from '../useOneKeyIdLocalKeylessOAuth';

import {
  type IOneKeyIdLoginMethod,
  getOneKeyIdLoginMethods,
} from './oneKeyIdLoginMethods';

const MORE_SIGN_IN_METHODS_VALUE = 'more-sign-in-methods';

function PrimeLoginOAuthDialog(props: {
  onComplete: () => Promise<void>;
  onLoginSuccess?: () => void | Promise<void>;
  onCancel?: () => void | Promise<void>;
  onReopenAfterOAuthFailure?: (options?: {
    showKeylessLogoutAction?: boolean;
  }) => void | Promise<void>;
  initialShowKeylessLogoutAction?: boolean;
  localKeylessLoginPrepareResult?: IOneKeyIdLoginWithLocalKeylessPrepareResult;
  localKeylessLoginPrepareErrorMessage?: string;
  toOneKeyIdPageOnLoginSuccess?: boolean;
}) {
  const {
    onComplete,
    onLoginSuccess,
    onCancel,
    onReopenAfterOAuthFailure,
    initialShowKeylessLogoutAction,
    localKeylessLoginPrepareResult,
    localKeylessLoginPrepareErrorMessage,
    toOneKeyIdPageOnLoginSuccess,
  } = props;
  const intl = useIntl();
  const { run: runIdentityExit } = useIdentityExitFlow();
  const [loggingInProvider, setLoggingInProvider] =
    useState<EOAuthSocialLoginProvider | null>(null);
  const [isEmailLoginStarting, setIsEmailLoginStarting] = useState(false);
  const [emailVerificationEmail, setEmailVerificationEmail] = useState<
    string | undefined
  >();
  const [expandedSignInMethod, setExpandedSignInMethod] = useState('');
  const [showKeylessLogoutAction, setShowKeylessLogoutAction] = useState(
    initialShowKeylessLogoutAction ?? false,
  );
  const loggingInProviderRef = useRef<EOAuthSocialLoginProvider | null>(null);
  const isEmailLoginStartingRef = useRef(false);
  const accountMismatchDetectedRef = useRef(
    initialShowKeylessLogoutAction ?? false,
  );
  const isDialogClosedForOAuthRef = useRef(false);
  loggingInProviderRef.current = loggingInProvider;
  const handleEmailSubmittingChange = useCallback(
    (nextIsEmailLoginStarting: boolean) => {
      isEmailLoginStartingRef.current = nextIsEmailLoginStarting;
      setIsEmailLoginStarting(nextIsEmailLoginStarting);
    },
    [],
  );
  const handleAccountMismatch = useCallback(() => {
    accountMismatchDetectedRef.current = true;
    if (!isDialogClosedForOAuthRef.current) {
      setShowKeylessLogoutAction(true);
    }
  }, []);
  const resetAccountMismatch = useCallback(() => {
    accountMismatchDetectedRef.current = false;
    if (!isDialogClosedForOAuthRef.current) {
      setShowKeylessLogoutAction(false);
    }
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
  const loginMethods = getOneKeyIdLoginMethods({
    isLocalKeylessOAuthMode,
    isLocalKeylessDataUnavailable:
      localKeylessLoginPrepareResult?.status ===
      EOneKeyIdLoginWithLocalKeylessPrepareStatus.LocalKeylessDataUnavailable,
    localKeylessProvider,
  });
  const isEmailVerificationStep = emailVerificationEmail !== undefined;
  const signInMethodsAccordionValue = isEmailVerificationStep
    ? MORE_SIGN_IN_METHODS_VALUE
    : expandedSignInMethod;
  const isSignInMethodsExpanded =
    signInMethodsAccordionValue === MORE_SIGN_IN_METHODS_VALUE;
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
      let didCloseDialogBeforeOAuth = false;
      let rollbackHandle: IKeylessOAuthSessionRollbackHandle | undefined;
      try {
        if (platformEnv.isNativeIOS && closeDialogOnSuccess) {
          // The iOS FullWindowOverlay sits above native auth controllers.
          // Wait for the dialog to disappear before presenting OAuth.
          await onComplete();
          didCloseDialogBeforeOAuth = true;
          isDialogClosedForOAuthRef.current = true;
        }
        let accessToken = '';
        let refreshToken = '';
        if (useRegularOAuthLogin) {
          const result = await getFreshOAuthTokensForRegularLogin({
            provider,
            missingTokenMessage: intl.formatMessage({
              id: ETranslations.global_unknown_error_retry_message,
            }),
          });
          accessToken = result.accessToken;
          refreshToken = result.refreshToken;
        } else {
          const result = await getOAuthAccessToken({
            provider,
            missingTokenMessage: intl.formatMessage({
              id: ETranslations.global_unknown_error_retry_message,
            }),
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
        if (closeDialogOnSuccess && !didCloseDialogBeforeOAuth) {
          await onComplete();
        }
        await onLoginSuccess?.();
      } catch (error) {
        if (!isOneKeyIdLoginCommitted) {
          showOneKeyIdLoginFailedToast({ error, intl });
        }
        if (didCloseDialogBeforeOAuth && !isOneKeyIdLoginCommitted) {
          if (onReopenAfterOAuthFailure) {
            await onReopenAfterOAuthFailure({
              showKeylessLogoutAction: accountMismatchDetectedRef.current,
            });
          } else {
            await onCancel?.();
          }
        }
        throw error;
      }
    },
    [
      getFreshOAuthTokensForRegularLogin,
      getOAuthAccessToken,
      intl,
      onCancel,
      onComplete,
      onLoginSuccess,
      onReopenAfterOAuthFailure,
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
        resetAccountMismatch();
        setLoggingInProvider(provider);
        await performOAuthLogin({
          provider,
          useRegularOAuthLogin: false,
          closeDialogOnSuccess: true,
        });
      } catch {
        // performOAuthLogin owns user feedback and restores the iOS dialog.
      } finally {
        loggingInProviderRef.current = null;
        setLoggingInProvider(null);
      }
    },
    [performOAuthLogin, resetAccountMismatch],
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
        resetAccountMismatch();
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
                throwLocalizedOneKeyIdLoginError({
                  intl,
                  reason: 'OAuth provider-switch continuation is unavailable.',
                });
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
      intl,
      localKeylessWalletId,
      onCancel,
      onComplete,
      performOAuthLogin,
      resetAccountMismatch,
      runIdentityExit,
    ],
  );

  const handleMalformedKeylessOAuth = useCallback(
    async (provider: EOAuthSocialLoginProvider) => {
      if (loggingInProviderRef.current || isEmailLoginStartingRef.current) {
        return;
      }
      loggingInProviderRef.current = provider;
      resetAccountMismatch();
      setLoggingInProvider(provider);

      let inspection;
      try {
        inspection =
          await backgroundApiProxy.serviceKeylessWallet.inspectLocalKeylessWalletForOAuth();
      } catch (error) {
        logOneKeyIdLoginFailureReason(
          `PrimeLoginOAuthDialog failed to inspect local Keyless wallet: ${getSanitizedAuthErrorText(
            error,
          )} prepareResult=${scrubSensitiveErrorMessageText(
            localKeylessLoginPrepareResult?.errorMessage || '',
          )} prepareError=${scrubSensitiveErrorMessageText(
            localKeylessLoginPrepareErrorMessage || '',
          )}`,
          error,
        );
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.keyless_wallet_data_unavailable__title,
          }),
          message: intl.formatMessage({
            id: ETranslations.keyless_wallet_data_unavailable__desc,
          }),
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
                throwLocalizedOneKeyIdLoginError({
                  intl,
                  reason:
                    'OAuth continuation after Keyless recovery is unavailable.',
                });
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
      intl,
      localKeylessLoginPrepareResult?.errorMessage,
      localKeylessLoginPrepareErrorMessage,
      onCancel,
      onComplete,
      performOAuthLogin,
      resetAccountMismatch,
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

  const renderOAuthLoginMethod = (method: IOneKeyIdLoginMethod) => {
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
      {isEmailVerificationStep ? null : (
        <Dialog.Header>
          <Dialog.Icon icon="OnekeyBrand" />
          <Dialog.Title testID="prime-login-title">
            {intl.formatMessage({
              id: ETranslations.sign_in_to_onekey_id__title,
            })}
          </Dialog.Title>
          <Dialog.Description color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.prime_onekeyid_continue_description,
            })}
          </Dialog.Description>
        </Dialog.Header>
      )}
      <YStack gap="$3">
        {isEmailVerificationStep ? null : (
          <>
            {loginMethods.map(renderOAuthLoginMethod)}
            {isLocalKeylessOAuthMode && localKeylessProvider ? (
              <SizableText size="$bodySm" color="$textSubdued" ta="center">
                {intl.formatMessage(
                  { id: ETranslations.use_keyless_linked_account__desc },
                  { provider: localKeylessProviderName },
                )}
              </SizableText>
            ) : null}
          </>
        )}
        <Accordion
          type="single"
          collapsible
          value={signInMethodsAccordionValue}
          onValueChange={setExpandedSignInMethod}
        >
          <Accordion.Item value={MORE_SIGN_IN_METHODS_VALUE}>
            {isEmailVerificationStep ? null : (
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
                      {intl.formatMessage({
                        id: ETranslations.more_sign_in_methods__action,
                      })}
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
            )}
            <HeightTransition hide={!isSignInMethodsExpanded}>
              <Accordion.Content
                unstyled
                forceMount
                testID="prime-login-more-methods-content"
                p={0}
                pt={isEmailVerificationStep ? 0 : '$3'}
                pointerEvents={isSignInMethodsExpanded ? 'auto' : 'none'}
                aria-hidden={!isSignInMethodsExpanded}
                accessibilityElementsHidden={!isSignInMethodsExpanded}
                importantForAccessibility={
                  isSignInMethodsExpanded ? 'auto' : 'no-hide-descendants'
                }
                {...(platformEnv.isNative
                  ? {}
                  : { inert: !isSignInMethodsExpanded })}
              >
                <PrimeLoginEmailDialogV2
                  embedded
                  embeddedVerificationEmail={emailVerificationEmail}
                  onEmbeddedVerificationEmailChange={setEmailVerificationEmail}
                  disabled={Boolean(loggingInProvider)}
                  onSubmittingChange={handleEmailSubmittingChange}
                  onComplete={onComplete}
                  onLoginSuccess={onLoginSuccess}
                  onCancel={onCancel}
                />
              </Accordion.Content>
            </HeightTransition>
          </Accordion.Item>
        </Accordion>
        {!isEmailVerificationStep &&
        showKeylessLogoutAction &&
        isLocalKeylessOAuthMode ? (
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
      {isEmailVerificationStep ? null : <Dialog.Footer showFooter={false} />}
    </Stack>
  );
}

export default PrimeLoginOAuthDialog;
