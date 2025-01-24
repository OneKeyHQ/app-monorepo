import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  OTPInput,
  RichSizeableText,
  Stack,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

const COUNTDOWN_TIME = 60;

export function PrimeLoginEmailCodeDialogV2(props: {
  email: string;
  loginWithCode: (args: { code: string; email?: string }) => Promise<void>;
  sendCode: (args: { email: string }) => void;
}) {
  const { email, loginWithCode, sendCode } = props;
  const [countdown, setCountdown] = useState(COUNTDOWN_TIME);
  const [isResending, setIsResending] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const intl = useIntl();

  const sendEmailVerificationCode = useCallback(async () => {
    setIsResending(true);

    if (isResending) {
      return;
    }

    try {
      sendCode({ email });

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
    void sendEmailVerificationCode();
  }, [sendEmailVerificationCode]);

  const buttonText = useMemo(() => {
    if (isResending)
      return intl.formatMessage({ id: ETranslations.prime_send_code }) + email;

    if (countdown > 0)
      return `${intl.formatMessage({
        id: ETranslations.prime_code_resend,
      })} (${countdown}s)`;

    return intl.formatMessage({ id: ETranslations.prime_code_resend });
  }, [isResending, intl, email, countdown]);

  return (
    <Stack>
      <Dialog.Icon icon="BarcodeSolid" />
      <Dialog.Title>
        {intl.formatMessage({
          id: ETranslations.prime_enter_verification_code,
        })}
      </Dialog.Title>
      <RichSizeableText
        size="$bodyLg"
        mt="$1.5"
        linkList={{
          email: {
            url: undefined,
            textDecorationLine: 'underline',
            color: '$textDefault',
          },
        }}
      >
        {`${intl.formatMessage({
          id: ETranslations.prime_sent_to,
        })}<email>${email}</email>`}
      </RichSizeableText>
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
            numberOfDigits={6}
            value={verificationCode}
            onTextChange={setVerificationCode}
          />
        </YStack>
      </Stack>
      <Dialog.Footer
        showCancelButton={false}
        onConfirmText="Next"
        onConfirm={async ({ preventClose }) => {
          try {
            await loginWithCode({
              code: verificationCode,
              email,
            });

            Toast.success({
              title: intl.formatMessage({
                id: ETranslations.login_welcome_message,
              }),
            });
          } catch (error) {
            console.log('error', error);

            Toast.error({
              title: intl.formatMessage({
                id: ETranslations.auth_error_passcode_incorrect,
              }),
            });
            preventClose();
            throw error;
          }
        }}
      />
    </Stack>
  );
}
