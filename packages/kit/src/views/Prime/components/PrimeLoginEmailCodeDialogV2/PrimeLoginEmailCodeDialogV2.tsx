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
import { ETranslations } from '@onekeyhq/shared/src/locale';

const COUNTDOWN_TIME = 60;

export function PrimeLoginEmailCodeDialogV2(props: {
  email: string;
  sendCode: (args: { email: string }) => Promise<void>;
  loginWithCode: (args: { code: string; email?: string }) => Promise<void>;
  onLoginSuccess?: () => void | Promise<void>;
  onConfirm: (code: string) => void;
}) {
  const { email, sendCode, loginWithCode, onLoginSuccess, onConfirm } = props;
  const [isSubmittingVerificationCode, setIsSubmittingVerificationCode] =
    useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_TIME);
  const [isResending, setIsResending] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [state, setState] = useState<{ status: 'initial' | 'error' | 'done' }>({
    status: 'initial',
  });
  const intl = useIntl();

  const sendEmailVerificationCode = useCallback(async () => {
    if (isResending) {
      return;
    }
    setIsResending(true);
    setState({ status: 'initial' });
    setVerificationCode('');
    try {
      await sendCode({ email });
      setCountdown(COUNTDOWN_TIME);
    } finally {
      setIsResending(false);
    }
  }, [email, isResending, sendCode]);

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
    if (onConfirm) {
      onConfirm?.(verificationCode);
      return;
    }
    if (isSubmittingVerificationCode) {
      return;
    }
    setIsSubmittingVerificationCode(true);

    Toast.success({
      title: 'handleConfirm success',
    });

    try {
      await loginWithCode({
        code: verificationCode,
        email,
      });

      Toast.success({
        title: 'loginWithCode success',
      });

      setState({ status: 'done' });
      await onLoginSuccess?.();
    } catch (error) {
      console.error('prime login error', error);
      setState({ status: 'error' });
    } finally {
      setIsSubmittingVerificationCode(false);
    }
  }, [
    onConfirm,
    isSubmittingVerificationCode,
    loginWithCode,
    verificationCode,
    email,
    onLoginSuccess,
  ]);

  // useEffect(() => {
  //   if (verificationCode.length === 6 && !isSubmittingVerificationCode) {
  //     void handleConfirm();
  //   }
  // }, [verificationCode, handleConfirm, isSubmittingVerificationCode]);

  return (
    <Stack>
      <Dialog.Header>
        <Dialog.Icon icon="BarcodeSolid" />
        <Dialog.Title>
          {intl.formatMessage({
            id: ETranslations.prime_enter_verification_code,
          })}
        </Dialog.Title>
        <Dialog.Description>
          {intl.formatMessage({ id: ETranslations.prime_sent_to }, { email })}
        </Dialog.Description>
      </Dialog.Header>

      <YStack gap="$2">
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
          loading: isSubmittingVerificationCode,
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
