import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';

import type { IOnboardingParamListV2 } from '@onekeyhq/shared/src/routes';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { PinInputLayout } from '../components/PinInputLayout';

import type { RouteProp } from '@react-navigation/core';

const MAX_ATTEMPTS = 7;

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
  const navigation = useAppNavigation();
  const route =
    useRoute<RouteProp<IOnboardingParamListV2, EOnboardingPagesV2.VerifyPin>>();
  const { verifyType = 'socialLogin' } = route.params ?? {};

  const isSocialLogin = verifyType === 'socialLogin';

  const [pin, setPin] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [attemptsRemaining, setAttemptsRemaining] = useState(MAX_ATTEMPTS);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [showAttemptError, setShowAttemptError] = useState(false);
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isInputDisabled = isSocialLogin && cooldownSeconds > 0;

  const { title, description } = useMemo(() => {
    if (isSocialLogin) {
      return {
        title: 'Enter your PIN',
        description:
          'This email already has a wallet created. Please enter your PIN to login.',
      };
    }
    return {
      title: 'Remember your PIN?',
      description:
        "Just a friendly reminder to keep your PIN fresh in memory. We'll check in from time to time.",
    };
  }, [isSocialLogin]);

  // Clear cooldown timer on unmount
  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) {
        clearInterval(cooldownTimerRef.current);
      }
    };
  }, []);

  const startCooldown = useCallback((seconds: number) => {
    if (seconds <= 0) {
      return;
    }
    setCooldownSeconds(seconds);
    setPin('');

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
  }, []);

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

  const handleVerify = useCallback(() => {
    // TODO: Verify against actual stored PIN on server
    const isCorrect = false; // Mock: always fail for testing

    if (isCorrect) {
      if (isSocialLogin) {
        navigation.push(EOnboardingPagesV2.CreatePasscode);
      } else {
        // For periodic verification, just go back
        navigation.pop();
      }
    } else {
      setPin('');

      if (isSocialLogin) {
        // Social login: apply retry mechanism with cooldown
        const newAttemptsRemaining = attemptsRemaining - 1;
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
        // Periodic verification: simple error message, no retry mechanism
        setErrorMessage('Incorrect PIN. Please try again.');
      }
    }
  }, [attemptsRemaining, isSocialLogin, navigation, startCooldown]);

  const handleForgotPin = useCallback(() => {
    if (isSocialLogin) {
      navigation.push(EOnboardingPagesV2.ResetPin);
    } else {
      navigation.push(EOnboardingPagesV2.CreatePin, { isResetPin: true });
    }
  }, [isSocialLogin, navigation]);

  // Build error message based on state
  const displayErrorMessage = (() => {
    if (errorMessage) {
      return errorMessage;
    }
    if (
      isSocialLogin &&
      showAttemptError &&
      attemptsRemaining < MAX_ATTEMPTS &&
      attemptsRemaining > 0
    ) {
      const baseMessage = `Incorrect PIN entered. ${attemptsRemaining} attempts remaining.`;
      if (cooldownSeconds > 0) {
        return `${baseMessage} Try again in ${formatCooldownTime(
          cooldownSeconds,
        )}.`;
      }
      return baseMessage;
    }
    return '';
  })();

  return (
    <PinInputLayout
      title={title}
      description={description}
      buttonText="Continue"
      secondaryButtonText={isSocialLogin ? 'Forgot PIN?' : 'Reset PIN'}
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

export { VerifyPinPage as default };
