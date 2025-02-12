import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  OTPInput,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

const COUNTDOWN_TIME = 60;

export function PrimeLoginEmailCodeDialogV2(props: {
  email: string;
  sendCode: (args: { email: string }) => Promise<void>;
  loginWithCode: (args: { code: string; email?: string }) => Promise<void>;
  onLoginSuccess?: () => void;
}) {
  const { email, sendCode, loginWithCode, onLoginSuccess } = props;
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

  return (
    <Stack>
      <Dialog.Icon icon="BarcodeSolid" />
      <Dialog.Title>
        {intl.formatMessage({
          id: ETranslations.prime_enter_verification_code,
        })}
      </Dialog.Title>

      <SizableText size="$bodyLg" color="$text">
        {`${intl.formatMessage(
          { id: ETranslations.prime_sent_to },
          { email },
        )}`}
      </SizableText>

      <Stack pt="$4">
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
            status={state.status === 'error' ? 'error' : 'normal'}
            numberOfDigits={6}
            value={verificationCode}
            onTextChange={(value) => {
              setState({ status: 'initial' });
              setVerificationCode(value);
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
      </Stack>
      <Dialog.Footer
        confirmButtonProps={{
          disabled: verificationCode.length !== 6,
        }}
        showCancelButton
        onConfirmText={intl.formatMessage({
          id: ETranslations.global_continue,
        })}
        onConfirm={async ({ preventClose }) => {
          try {
            await loginWithCode({
              code: verificationCode,
              email,
            });
            setState({ status: 'done' });
            onLoginSuccess?.();
          } catch (error) {
            setState({ status: 'error' });
            preventClose();
          }
        }}
      />
    </Stack>
  );
}
