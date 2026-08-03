import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  OTPInput,
  SizableText,
  Stack,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useIsMounted } from '@onekeyhq/kit/src/hooks/useIsMounted';
import { getSanitizedAuthErrorText } from '@onekeyhq/kit/src/views/Prime/components/oneKeyIdLoginToastUtils';
import { EMAIL_OTP_COUNTDOWN_SECONDS } from '@onekeyhq/shared/src/consts/authConsts';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { isTransientNetworkLikeError } from '@onekeyhq/shared/src/utils/transientNetworkErrorUtils';

import { getEmailOtpRequestErrorMessage } from './emailOtpErrorUtils';
import { getEmailOtpRateLimitRetryAfterSeconds } from './emailOtpRateLimitError';

export function EmailOTPDialog(props: {
  title: string;
  description: string;
  sendCode: () => Promise<unknown>;
  onConfirm: (code: string) => void | Promise<void>;
  hideResendButton?: boolean;
}) {
  const { sendCode, onConfirm, title, description, hideResendButton } = props;
  const [isSubmittingVerificationCode, setIsSubmittingVerificationCode] =
    useState(false);
  const [countdown, setCountdown] = useState(EMAIL_OTP_COUNTDOWN_SECONDS);
  const [isResending, setIsResending] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const didRequestInitialCodeRef = useRef(false);
  const isResendingRef = useRef(false);
  const isMountedRef = useIsMounted();
  const [state, setState] = useState<{
    status: 'initial' | 'error' | 'done';
    errorMessageId?: ETranslations;
  }>({
    status: 'initial',
  });
  const intl = useIntl();

  useEffect(() => {
    if (didRequestInitialCodeRef.current) {
      return;
    }
    didRequestInitialCodeRef.current = true;
    void sendCode().catch((error) => {
      if (isMountedRef.current) {
        console.error(
          'Email verification code request failed:',
          getSanitizedAuthErrorText(error),
        );
        setCountdown(0);
        const retryAfterSeconds = getEmailOtpRateLimitRetryAfterSeconds(error);
        if (retryAfterSeconds !== undefined) {
          setCountdown(retryAfterSeconds);
        }
        const errorMessage = getEmailOtpRequestErrorMessage({ error, intl });
        if (errorMessage) {
          Toast.error({ title: errorMessage });
        }
      }
    });
  }, [intl, isMountedRef, sendCode]);

  const sendEmailVerificationCode = useCallback(async () => {
    if (isResendingRef.current) {
      return;
    }
    isResendingRef.current = true;
    setIsResending(true);
    setState({ status: 'initial' });
    setVerificationCode('');
    try {
      await sendCode();
      if (!isMountedRef.current) {
        return;
      }
      setCountdown(EMAIL_OTP_COUNTDOWN_SECONDS);
    } catch (error) {
      if (isMountedRef.current) {
        console.error(
          'Email verification code resend failed:',
          getSanitizedAuthErrorText(error),
        );
        const retryAfterSeconds = getEmailOtpRateLimitRetryAfterSeconds(error);
        setCountdown(retryAfterSeconds ?? 0);
        const errorMessage = getEmailOtpRequestErrorMessage({ error, intl });
        if (errorMessage) {
          Toast.error({ title: errorMessage });
        }
      }
    } finally {
      isResendingRef.current = false;
      if (isMountedRef.current) {
        setIsResending(false);
      }
    }
  }, [intl, isMountedRef, sendCode]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (countdown > 0) {
      timer = setTimeout(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [countdown]);

  const buttonText = useMemo(() => {
    if (countdown > 0)
      return intl.formatMessage(
        { id: ETranslations.resend_code_countdown__action },
        { seconds: countdown },
      );

    return intl.formatMessage({ id: ETranslations.prime_code_resend });
  }, [intl, countdown]);

  const handleConfirm = useCallback(async () => {
    try {
      setIsConfirming(true);
      await onConfirm(verificationCode);
    } catch (error) {
      console.error(
        'Email verification code confirmation failed:',
        getSanitizedAuthErrorText(error),
      );
      // Not every consume failure means the code was wrong — a transient
      // network failure or an expired OneKey ID login must not be rendered
      // as "invalid verification code" (which tells the user to retype a
      // code that was never the problem). Classification relies only on
      // fields that survive bridge serialization (name / key / status).
      if (isTransientNetworkLikeError(error)) {
        setState({
          status: 'initial',
          errorMessageId: ETranslations.global_network_error,
        });
      } else if (
        (error as IOneKeyError | undefined)?.key ===
        ETranslations.id_login_expired_description
      ) {
        // OneKeyErrorPrimeLoginInvalidToken (90002/90003): the login was
        // invalidated while the dialog was open; retyping the code cannot
        // succeed.
        setState({
          status: 'initial',
          errorMessageId: ETranslations.id_login_expired_description,
        });
      } else {
        setState({
          status: 'error',
          errorMessageId: ETranslations.prime_invalid_verification_code,
        });
      }
    } finally {
      setIsSubmittingVerificationCode(false);
      setIsConfirming(false);
    }
  }, [onConfirm, verificationCode]);

  return (
    <Stack>
      <Dialog.Header>
        <Dialog.Icon icon="BarcodeSolid" />
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Description>{description}</Dialog.Description>
      </Dialog.Header>

      <YStack gap="$2">
        {!hideResendButton ? (
          <XStack>
            <Button
              testID="one-key-auth-handle-confirm-btn"
              width="auto"
              size="small"
              variant="tertiary"
              disabled={countdown > 0 || isResending}
              onPress={sendEmailVerificationCode}
            >
              {buttonText}
            </Button>
          </XStack>
        ) : null}

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

        {state.errorMessageId ? (
          <SizableText size="$bodyMd" color="$red9">
            {intl.formatMessage({
              id: state.errorMessageId,
            })}
          </SizableText>
        ) : null}
      </YStack>
      <Dialog.Footer
        showCancelButton={false}
        confirmButtonProps={{
          loading: isSubmittingVerificationCode || isConfirming,
          disabled: verificationCode.length !== 6,
        }}
        onConfirmText={intl.formatMessage({
          id: ETranslations.global_next,
        })}
        onConfirm={async ({ preventClose }) => {
          preventClose();
          await handleConfirm();
        }}
      />
    </Stack>
  );
}

export default EmailOTPDialog;
