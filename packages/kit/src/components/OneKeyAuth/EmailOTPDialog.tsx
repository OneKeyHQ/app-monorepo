import { useCallback, useEffect, useMemo, useState } from 'react';

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
import { EMAIL_OTP_COUNTDOWN_SECONDS } from '@onekeyhq/shared/src/consts/authConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';

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
  const [state, setState] = useState<{ status: 'initial' | 'error' | 'done' }>({
    status: 'initial',
  });
  const intl = useIntl();

  useMemo(() => {
    void sendCode().catch((error) => {
      Toast.error({
        title: (error as Error)?.message,
      });
      throw error;
    });
  }, [sendCode]);

  const sendEmailVerificationCode = useCallback(async () => {
    if (isResending) {
      return;
    }
    setIsResending(true);
    setState({ status: 'initial' });
    setVerificationCode('');
    try {
      await sendCode();
      setCountdown(EMAIL_OTP_COUNTDOWN_SECONDS);
    } catch (error) {
      Toast.error({
        title: (error as Error)?.message,
      });
      throw error;
    } finally {
      setIsResending(false);
    }
  }, [isResending, sendCode]);

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
      return `${intl.formatMessage({
        id: ETranslations.prime_code_resend,
      })} (${countdown}s)`;

    return intl.formatMessage({ id: ETranslations.prime_code_resend });
  }, [intl, countdown]);

  const handleConfirm = useCallback(async () => {
    try {
      setIsConfirming(true);
      await onConfirm(verificationCode);
    } catch (error) {
      console.error('sendEmailOTP error', error);
      setState({ status: 'error' });
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

        {state.status === 'error' ? (
          <SizableText size="$bodyMd" color="$red9">
            {intl.formatMessage({
              id: ETranslations.prime_invalid_verification_code,
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
