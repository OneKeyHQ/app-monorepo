import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { intervalToDuration } from 'date-fns';
import { isNil } from 'lodash';
import { useIntl } from 'react-intl';

import { Dialog, Toast } from '@onekeyhq/components';
import { JUICEBOX_ALLOWED_GUESSES } from '@onekeyhq/shared/src/consts/authConsts';
import type { IIncorrectPinErrorInfo } from '@onekeyhq/shared/src/errors/errors/appErrors';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import { EKeylessFinalizeAction } from '@onekeyhq/shared/src/keylessWallet/keylessWalletConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IOnboardingParamListV2 } from '@onekeyhq/shared/src/routes';
import {
  EOnboardingPagesV2,
  EOnboardingV2OneKeyIDLoginMode,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector/AccountSelectorProvider';
import {
  useKeylessWallet,
  useVerifyKeylessPinChecking,
} from '../../../components/KeylessWallet/useKeylessWallet';
import useAppNavigation from '../../../hooks/useAppNavigation';
import useFormatDate from '../../../hooks/useFormatDate';
import {
  type IPinInputLayoutRef,
  PinInputLayout,
} from '../components/PinInputLayout';

import type { RouteProp } from '@react-navigation/core';

const MAX_ATTEMPTS = JUICEBOX_ALLOWED_GUESSES;

function VerifyPinPage() {
  const intl = useIntl();
  const { formatDuration } = useFormatDate();
  const navigation = useAppNavigation();
  const route =
    useRoute<RouteProp<IOnboardingParamListV2, EOnboardingPagesV2.VerifyPin>>();
  const { mode } = route.params ?? {};
  const { verifyKeylessOnboardingPin, getKeylessOnboardingToken } =
    useKeylessWallet();
  const { cancelVerifyPin } = useVerifyKeylessPinChecking();
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingRateLimit, setIsCheckingRateLimit] = useState(true);
  const pinInputRef = useRef<IPinInputLayoutRef | null>(null);

  const [pin, setPin] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [attemptsRemaining, setAttemptsRemaining] = useState(MAX_ATTEMPTS);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [showAttemptError, setShowAttemptError] = useState(false);
  const [isManuallyEnabled, setIsManuallyEnabled] = useState(false);
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCancelTimeRef = useRef<number>(0);
  const [dangerousRetryByFixedProvider, setDangerousRetryByFixedProvider] =
    useState(false);

  const isInputDisabled =
    (cooldownSeconds > 0 || isCheckingRateLimit) && !isManuallyEnabled;
  const isVerifyPinOnly =
    mode === EOnboardingV2OneKeyIDLoginMode.KeylessVerifyPinOnly;

  const { title, description } = useMemo(() => {
    if (isVerifyPinOnly) {
      return {
        title: intl.formatMessage({ id: ETranslations.remember_your_pin }),
        description: intl.formatMessage({
          id: ETranslations.remember_your_pin_desc,
        }),
      };
    }
    return {
      title: intl.formatMessage({ id: ETranslations.enter_your_pin }),
      description: intl.formatMessage({
        id: ETranslations.enter_your_pin_desc,
      }),
    };
  }, [isVerifyPinOnly, intl]);

  // Clear cooldown timer on unmount
  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) {
        clearInterval(cooldownTimerRef.current);
      }
      if (focusTimerRef.current) {
        clearTimeout(focusTimerRef.current);
      }
    };
  }, []);

  const startCooldown = useCallback(
    (seconds: number) => {
      if (seconds <= 0) {
        return;
      }
      setCooldownSeconds(seconds);
      setIsManuallyEnabled(false);
      setPin('');

      // Clear previous focus timer if exists
      if (focusTimerRef.current) {
        clearTimeout(focusTimerRef.current);
      }

      // Focus the input after clearing PIN
      focusTimerRef.current = setTimeout(
        () => {
          if (pinInputRef.current) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            pinInputRef.current.focus();
          }
        },
        platformEnv.isNative ? 100 : 50,
      );

      if (cooldownTimerRef.current) {
        clearInterval(cooldownTimerRef.current);
      }
      cooldownTimerRef.current = setInterval(() => {
        setCooldownSeconds((prev) => {
          if (prev <= 1) {
            if (cooldownTimerRef.current) {
              clearInterval(cooldownTimerRef.current);
              cooldownTimerRef.current = null;
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    },
    [pinInputRef],
  );

  const handleForgotPin = useCallback(
    async ({
      shouldVerifyPasswordFirst,
    }: { shouldVerifyPasswordFirst?: boolean } = {}) => {
      if (isVerifyPinOnly) {
        if (shouldVerifyPasswordFirst) {
          await backgroundApiProxy.servicePassword.promptPasswordVerify({
            reason: EReasonForNeedPassword.Security,
          });
        } else {
          await backgroundApiProxy.servicePassword.clearCachedPassword();
        }
        navigation.push(EOnboardingPagesV2.CreatePin, {
          action: EKeylessFinalizeAction.ResetPin,
        });
      } else {
        // Navigate to ResetPinGuide page which is a guide page showing instructions
        // on how to reset PIN using another device, not the actual reset operation page.
        // The actual reset operation happens in CreatePinPage when action is ResetPin.
        navigation.push(EOnboardingPagesV2.ResetPinGuide);
      }
    },
    [navigation, isVerifyPinOnly],
  );

  // Check rate limit status - reusable function
  const checkRateLimitStatus = useCallback(
    async ({ isFirstCheck }: { isFirstCheck: boolean }) => {
      try {
        setIsCheckingRateLimit(true);
        const token = await getKeylessOnboardingToken();
        if (!token) {
          return;
        }

        const result =
          await backgroundApiProxy.serviceKeylessWallet.apiCheckRateLimitStatus(
            {
              token,
            },
          );

        // Check if PIN attempts are exceeded
        if (!isNil(result.guessesRemaining) && result.guessesRemaining <= 0) {
          if (isFirstCheck) {
            // Max attempts reached - show toast and redirect to reset PIN page
            Toast.error({
              title: intl.formatMessage({
                id: ETranslations.pin_attempts_exhausted,
              }),
            });
          }
          await handleForgotPin();
          return;
        }

        if (result.isRateLimited && result.retryAfterSeconds > 0) {
          startCooldown(result.retryAfterSeconds);
        }
      } catch (error) {
        // Silently handle errors to not block user operations
        console.error('Failed to check rate limit status:', error);
      } finally {
        setIsCheckingRateLimit(false);
        // Focus is now handled by PinInputLayout when skeleton transitions to input
      }
    },
    [getKeylessOnboardingToken, handleForgotPin, intl, startCooldown],
  );

  // Check rate limit status on page enter
  useEffect(() => {
    void checkRateLimitStatus({ isFirstCheck: true });
  }, [checkRateLimitStatus]);

  const formatCooldownTime = useCallback(
    (seconds: number) => {
      const duration = intervalToDuration({ start: 0, end: seconds * 1000 });
      return formatDuration(duration);
    },
    [formatDuration],
  );

  const handlePinChange = useCallback(
    (filteredText: string) => {
      if (isInputDisabled) {
        return;
      }
      setPin(filteredText);
      setErrorMessage('');
      setShowAttemptError(false);
    },
    [isInputDisabled],
  );

  const handleEnableInput = useCallback(() => {
    setIsManuallyEnabled(true);
  }, []);
  const onTitleMultipleClick = useCallback(() => {
    if (mode === EOnboardingV2OneKeyIDLoginMode.KeylessCreateOrRestore) {
      Dialog.confirm({
        title: 'Continue with provider fixed?',
        onConfirmText: intl.formatMessage({
          id: ETranslations.global_continue_anyway,
        }),
        onConfirm: () => {
          setDangerousRetryByFixedProvider(true);
        },
      });
    }
  }, [intl, mode]);

  const isSubmitSuccessRef = useRef(false);
  const handleVerify = useCallback(async () => {
    try {
      isSubmitSuccessRef.current = false;
      setIsLoading(true);
      await verifyKeylessOnboardingPin({
        pin,
        mode,
        dangerousRetryByFixedProvider,
      });
      isSubmitSuccessRef.current = true;
    } catch (e) {
      // checking limit
      isSubmitSuccessRef.current = false;
      void checkRateLimitStatus({ isFirstCheck: false });
      if (
        errorUtils.isErrorByClassName({
          error: e,
          className: EOneKeyErrorClassNames.IncorrectPinError,
        })
      ) {
        const errorInfo = (e as { info?: IIncorrectPinErrorInfo })?.info;
        const newAttemptsRemaining = errorInfo?.guessesRemaining ?? 0;

        setAttemptsRemaining(newAttemptsRemaining);
        setShowAttemptError(true);

        if (!isNil(errorInfo?.guessesRemaining) && newAttemptsRemaining <= 0) {
          // Since IncorrectPinError is in the ignore list defined in errorToastUtils.ts and won't show a default Toast, we need to explicitly call Toast here
          Toast.error({
            title: intl.formatMessage({
              id: ETranslations.pin_attempts_exhausted,
            }),
          });
          void handleForgotPin();
        }
      } else {
        throw e;
      }
    } finally {
      setIsLoading(false);
      setPin('');
      // Focus the input after clearing PIN
      setTimeout(
        () => {
          if (pinInputRef.current) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            pinInputRef.current.focus();
          }
        },
        platformEnv.isNative ? 100 : 50,
      );
    }
  }, [
    intl,
    pin,
    mode,
    dangerousRetryByFixedProvider,
    pinInputRef,
    verifyKeylessOnboardingPin,
    handleForgotPin,
    checkRateLimitStatus,
  ]);

  const handleCancelVerifyPin = useCallback(async () => {
    if (
      mode === EOnboardingV2OneKeyIDLoginMode.KeylessVerifyPinOnly &&
      !isSubmitSuccessRef.current
    ) {
      const now = Date.now();
      const timeSinceLastCancel = now - lastCancelTimeRef.current;

      // Skip cancel if called within 2 second of last cancel
      if (timeSinceLastCancel < 2000) {
        return;
      }

      lastCancelTimeRef.current = now;
      await cancelVerifyPin('CURRENT_KEYLESS_WALLET');
    }
  }, [cancelVerifyPin, mode]);

  // Cancel verify pin on unmount if needed
  useEffect(() => {
    return () => {
      void handleCancelVerifyPin();
    };
  }, [handleCancelVerifyPin]);

  // Build error message based on state
  const displayErrorMessage = (() => {
    if (errorMessage) {
      return errorMessage;
    }
    if (showAttemptError && attemptsRemaining > 0) {
      const baseMessage = intl.formatMessage(
        {
          id: ETranslations.pin_attempts_remaining,
        },
        {
          attemptsRemaining,
        },
      );
      if (cooldownSeconds > 0) {
        return `${baseMessage} ${intl.formatMessage(
          { id: ETranslations.pin_attempts_cooldown },
          {
            seconds: formatCooldownTime(cooldownSeconds),
          },
        )}`;
      }
      return baseMessage;
    }
    // Rate-limited state from API (initial cooldown, not from user input error)
    if (cooldownSeconds > 0) {
      return intl.formatMessage(
        { id: ETranslations.pin_attempts_cooldown },
        {
          seconds: formatCooldownTime(cooldownSeconds),
        },
      );
    }
    return '';
  })();

  const handleAutoInputPin = useCallback(async () => {
    const debugPin = '1234';
    setPin(debugPin);
    try {
      setIsLoading(true);
      await verifyKeylessOnboardingPin({
        pin: debugPin,
        mode,
        dangerousRetryByFixedProvider,
      });
    } catch (e) {
      void checkRateLimitStatus({ isFirstCheck: false });
      if (
        errorUtils.isErrorByClassName({
          error: e,
          className: EOneKeyErrorClassNames.IncorrectPinError,
        })
      ) {
        const errorInfo = (e as { info?: IIncorrectPinErrorInfo })?.info;
        const newAttemptsRemaining = errorInfo?.guessesRemaining ?? 0;
        setAttemptsRemaining(newAttemptsRemaining);
        setShowAttemptError(true);
        if (!isNil(errorInfo?.guessesRemaining) && newAttemptsRemaining <= 0) {
          void handleForgotPin();
        }
      }
      // Silently continue for auto-retry
    } finally {
      setIsLoading(false);
      setPin('');
    }
  }, [
    mode,
    verifyKeylessOnboardingPin,
    checkRateLimitStatus,
    handleForgotPin,
    dangerousRetryByFixedProvider,
  ]);

  return (
    <PinInputLayout
      ref={pinInputRef}
      isLoading={isLoading}
      onClose={async () => {
        void handleCancelVerifyPin();
      }}
      onUnmounted={() => {
        void handleCancelVerifyPin();
      }}
      title={title}
      placeholder=""
      description={description}
      buttonText={intl.formatMessage({ id: ETranslations.global_continue })}
      secondaryButtonText={
        isVerifyPinOnly
          ? intl.formatMessage({ id: ETranslations.forgot_pin })
          : intl.formatMessage({ id: ETranslations.reset_pin })
      }
      onSecondaryButtonPress={() =>
        handleForgotPin({ shouldVerifyPasswordFirst: true })
      }
      value={pin}
      onChange={handlePinChange}
      onSubmit={handleVerify}
      isSubmitDisabled={pin.length !== 4 || isInputDisabled}
      isInputDisabled={isInputDisabled}
      onEnableInput={handleEnableInput}
      onTitleMultipleClick={onTitleMultipleClick}
      errorMessage={displayErrorMessage}
      isVerifyPinPage
      onAutoInputPin={handleAutoInputPin}
      showInputSkeleton={isCheckingRateLimit}
    />
  );
}

function VerifyPinPageWithContext() {
  return (
    <AccountSelectorProviderMirror
      enabledNum={[0]}
      config={{
        sceneName: EAccountSelectorSceneName.home,
      }}
    >
      <VerifyPinPage />
    </AccountSelectorProviderMirror>
  );
}

export { VerifyPinPageWithContext as default };
