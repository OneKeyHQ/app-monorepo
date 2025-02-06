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

import { usePrivyUniversalV2 } from '../../hooks/usePrivyUniversalV2';

const COUNTDOWN_TIME = 60;

export function PrimeLoginEmailCodeDialogV2(props: {
  email: string;
  onLoginSuccess?: () => void;
}) {
  const { email } = props;
  const [countdown, setCountdown] = useState(COUNTDOWN_TIME);
  const [isResending, setIsResending] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const intl = useIntl();

  const { useLoginWithEmail } = usePrivyUniversalV2();
  const { sendCode, loginWithCode, state } = useLoginWithEmail({
    onComplete: () => {
      console.log('🔑 ✅ User successfully logged in with email');
    },
    onError: (error) => {
      console.log(error);
    },
  });

  const sendEmailVerificationCode = useCallback(async () => {
    setIsResending(true);

    if (isResending) {
      return;
    }

    try {
      console.log('sendCode', email);
      void sendCode({ email });

      setCountdown(COUNTDOWN_TIME);
    } finally {
      setIsResending(false);
    }
  }, [email, isResending, sendCode]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [countdown]);

  useEffect(() => {
    console.log('state.status', state.status);
    if (state.status === 'initial') {
      void sendEmailVerificationCode();
    }
  }, [sendEmailVerificationCode, state.status]);

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

      <SizableText textDecorationLine="underline">
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
            onTextChange={setVerificationCode}
          />
        </YStack>
      </Stack>
      <Dialog.Footer
        confirmButtonProps={{
          disabled: verificationCode.length !== 6,
        }}
        showCancelButton={false}
        onConfirmText="Next"
        onConfirm={async () => {
          try {
            await loginWithCode({
              code: verificationCode,
              email,
            });
          } catch (error) {
            console.log('error', error);
            throw error;
          }
        }}
      />
    </Stack>
  );
}
