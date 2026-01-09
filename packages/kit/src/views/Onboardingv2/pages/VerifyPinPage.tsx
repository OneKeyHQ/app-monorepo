import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

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

import { AccountSelectorProviderMirror } from '../../../components/AccountSelector/AccountSelectorProvider';
import { useKeylessWallet } from '../../../components/KeylessWallet/useKeylessWallet';
import useAppNavigation from '../../../hooks/useAppNavigation';
import {
  type IPinInputLayoutRef,
  PinInputLayout,
} from '../components/PinInputLayout';

import type { RouteProp } from '@react-navigation/core';

const MAX_ATTEMPTS = JUICEBOX_ALLOWED_GUESSES;

// Cooldown times based on attempt number (in seconds)
// Attempt 1: 0, Attempt 2: 30s, Attempt 3: 60s, Attempt 4: 120s, Attempt 5-6: 300s
const COOLDOWN_BY_ATTEMPT: Record<number, number> = {
  1: 0, // First attempt: no cooldown
  2: 30, // 0.5 min
  3: 60, // 1 min
  4: 120, // 2 min
  5: 300, // 5 min
  6: 300, // 5 min
};

function VerifyPinPage() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const route =
    useRoute<RouteProp<IOnboardingParamListV2, EOnboardingPagesV2.VerifyPin>>();
  const { mode } = route.params ?? {};
  const { verifyKeylessOnboardingPin } = useKeylessWallet();
  const [isLoading, setIsLoading] = useState(false);
  const pinInputRef = useRef<IPinInputLayoutRef | null>(null);

  const [pin, setPin] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [attemptsRemaining, setAttemptsRemaining] = useState(MAX_ATTEMPTS);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [showAttemptError, setShowAttemptError] = useState(false);
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isInputDisabled = cooldownSeconds > 0;
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
    };
  }, []);

  const startCooldown = useCallback(
    (seconds: number) => {
      if (seconds <= 0) {
        return;
      }
      setCooldownSeconds(seconds);
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

  const formatCooldownTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

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

  const handleVerify = useCallback(async () => {
    try {
      setIsLoading(true);
      await verifyKeylessOnboardingPin({ pin, mode });
    } catch (e) {
      if (
        errorUtils.isErrorByClassName({
          error: e,
          className: EOneKeyErrorClassNames.IncorrectPinError,
        })
      ) {
        const errorInfo = (e as { info?: IIncorrectPinErrorInfo })?.info;
        const newAttemptsRemaining = errorInfo?.guessesRemaining ?? 0;
        const attemptNumber = MAX_ATTEMPTS - newAttemptsRemaining;

        setAttemptsRemaining(newAttemptsRemaining);
        setShowAttemptError(true);

        if (newAttemptsRemaining <= 0) {
          // Max attempts reached - redirect to reset PIN page
          navigation.replace(EOnboardingPagesV2.ResetPin);
        } else {
          // Get cooldown time for this attempt
          const cooldownTime = COOLDOWN_BY_ATTEMPT[attemptNumber] || 0;
          if (cooldownTime > 0) {
            startCooldown(cooldownTime);
          }
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
    pin,
    mode,
    pinInputRef,
    verifyKeylessOnboardingPin,
    navigation,
    startCooldown,
  ]);

  const handleForgotPin = useCallback(() => {
    if (isVerifyPinOnly) {
      navigation.push(EOnboardingPagesV2.CreatePin, {
        action: EKeylessFinalizeAction.ResetPin,
      });
    } else {
      navigation.push(EOnboardingPagesV2.ResetPin);
    }
  }, [navigation, isVerifyPinOnly]);

  // Build error message based on state
  const displayErrorMessage = (() => {
    if (errorMessage) {
      return errorMessage;
    }
    if (
      showAttemptError &&
      attemptsRemaining < MAX_ATTEMPTS &&
      attemptsRemaining > 0
    ) {
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
    return '';
  })();

  return (
    <PinInputLayout
      ref={pinInputRef}
      isLoading={isLoading}
      title={title}
      placeholder=""
      description={description}
      buttonText={intl.formatMessage({ id: ETranslations.global_continue })}
      secondaryButtonText={
        isVerifyPinOnly
          ? intl.formatMessage({ id: ETranslations.forgot_pin })
          : intl.formatMessage({ id: ETranslations.reset_pin })
      }
      onSecondaryButtonPress={handleForgotPin}
      value={pin}
      onChange={handlePinChange}
      onSubmit={handleVerify}
      isSubmitDisabled={pin.length !== 4 || isInputDisabled}
      isInputDisabled={isInputDisabled}
      errorMessage={displayErrorMessage}
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
