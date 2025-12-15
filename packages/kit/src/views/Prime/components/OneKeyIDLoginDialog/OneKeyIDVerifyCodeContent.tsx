import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  OTPInput,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

const COUNTDOWN_TIME = 60;

export interface IOneKeyIDVerifyCodeContentProps {
  email: string;
  sendCode: (args: { email: string }) => Promise<void>;
  loginWithCode: (args: { code: string; email?: string }) => Promise<void>;
  onLoginSuccess?: () => void | Promise<void>;
  onBack?: () => void;
}

export function OneKeyIDVerifyCodeContent({
  email,
  sendCode,
  loginWithCode,
  onLoginSuccess,
  onBack,
}: IOneKeyIDVerifyCodeContentProps) {
  const intl = useIntl();
  const [isSubmittingVerificationCode, setIsSubmittingVerificationCode] =
    useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_TIME);
  const [isResending, setIsResending] = useState(false);
  const isResendingRef = useRef(isResending);
  isResendingRef.current = isResending;
  const [verificationCode, setVerificationCode] = useState('');
  const [state, setState] = useState<{ status: 'initial' | 'error' | 'done' }>({
    status: 'initial',
  });
  const [isApiReady, setIsApiReady] = useState(false);
  const hasSentInitialCodeRef = useRef(false);

  const sendEmailVerificationCode = useCallback(
    async (isInitial = false) => {
      if (isResendingRef.current) {
        return;
      }
      setIsResending(true);
      setState({ status: 'initial' });
      // Only clear verification code when resending, not on initial send
      if (!isInitial) {
        setVerificationCode('');
      }
      try {
        await sendCode({ email });
        setIsApiReady(true);
        setCountdown(COUNTDOWN_TIME);
      } finally {
        setIsResending(false);
      }
      defaultLogger.referral.page.signupOneKeyID();
    },
    [email, sendCode],
  );

  useEffect(() => {
    if (!hasSentInitialCodeRef.current) {
      hasSentInitialCodeRef.current = true;
      void sendEmailVerificationCode(true);
    }
  }, [sendEmailVerificationCode]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (countdown > 0 && isApiReady) {
      timer = setTimeout(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [countdown, isApiReady]);

  const buttonText = useMemo(() => {
    if (!isApiReady) {
      return intl.formatMessage({
        id: ETranslations.global_processing,
      });
    }

    if (countdown > 0) {
      return `${intl.formatMessage({
        id: ETranslations.prime_code_resend,
      })} (${countdown}s)`;
    }

    return intl.formatMessage({ id: ETranslations.prime_code_resend });
  }, [intl, countdown, isApiReady]);

  const handleResend = useCallback(() => {
    void sendEmailVerificationCode(false);
  }, [sendEmailVerificationCode]);

  const handleConfirm = useCallback(async () => {
    if (isSubmittingVerificationCode) {
      return;
    }
    setIsSubmittingVerificationCode(true);

    try {
      await loginWithCode({
        code: verificationCode,
        email,
      });

      setState({ status: 'done' });
      await onLoginSuccess?.();
      defaultLogger.referral.page.signupOneKeyIDResult(true);
    } catch (error) {
      console.error('prime login error', error);
      const e = error as Error | undefined;
      if (
        e?.message &&
        [
          'Too many requests. Please wait to try again.',
          'Must initialize a passwordless code flow first',
        ].includes(e?.message)
      ) {
        void sendEmailVerificationCode(false);
      } else {
        setState({ status: 'error' });
      }
      defaultLogger.referral.page.signupOneKeyIDResult(false);
    } finally {
      setIsSubmittingVerificationCode(false);
    }
  }, [
    sendEmailVerificationCode,
    isSubmittingVerificationCode,
    verificationCode,
    loginWithCode,
    email,
    onLoginSuccess,
  ]);

  // Auto-submit when 6 digits are entered
  useEffect(() => {
    if (verificationCode.length === 6) {
      void handleConfirm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verificationCode]);

  return (
    <YStack gap="$4">
      <SizableText color="$textSubdued">
        A verification code was sent to{' '}
        <SizableText color="$text">{email}</SizableText>
      </SizableText>

      <YStack gap="$2">
        <OTPInput
          autoFocus
          status={state.status === 'error' ? 'error' : 'normal'}
          numberOfDigits={6}
          value={verificationCode}
          onTextChange={(value) => {
            setVerificationCode(value);
            setState({ status: 'initial' });
          }}
        />

        {state.status === 'error' ? (
          <SizableText size="$bodyMd" color="$red9">
            {intl.formatMessage({
              id: ETranslations.prime_invalid_verification_code,
            })}
          </SizableText>
        ) : null}
      </YStack>

      <XStack gap="$2.5">
        {onBack ? (
          <Button
            flexGrow={1}
            flexBasis={0}
            size="large"
            $gtMd={{ size: 'medium' }}
            onPress={onBack}
          >
            {intl.formatMessage({ id: ETranslations.global_cancel })}
          </Button>
        ) : null}
        <Button
          flexGrow={1}
          flexBasis={0}
          variant="primary"
          size="large"
          loading={isSubmittingVerificationCode}
          onPress={handleConfirm}
        >
          {intl.formatMessage({ id: ETranslations.global_confirm })}
        </Button>
      </XStack>

      <Button
        m={0}
        alignSelf="center"
        size="small"
        variant="tertiary"
        disabled={countdown > 0 || isResending || !isApiReady}
        onPress={handleResend}
      >
        {buttonText}
      </Button>
    </YStack>
  );
}
