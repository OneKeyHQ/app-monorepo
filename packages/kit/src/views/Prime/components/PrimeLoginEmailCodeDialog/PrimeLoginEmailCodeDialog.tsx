import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  Button,
  Dialog,
  RichSizeableText,
  Stack,
  Toast,
  VerificationCodeInput,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePrimeLoginDialogAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

const COUNTDOWN_TIME = 60;

export function PrimeLoginEmailCodeDialog({
  promiseId,
}: {
  promiseId: number;
}) {
  const [{ promptPrimeLoginEmailCodeDialog }] = usePrimeLoginDialogAtom();
  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(COUNTDOWN_TIME);
  const [isResending, setIsResending] = useState(false);

  const sendEmailVerificationCode = useCallback(async () => {
    setIsResending(true);
    try {
      await backgroundApiProxy.servicePrime.apiSendEmailVerificationCode({
        email: promptPrimeLoginEmailCodeDialog?.email || '',
        verifyUUID: promptPrimeLoginEmailCodeDialog?.verifyUUID || '',
      });
      setCountdown(COUNTDOWN_TIME);
    } finally {
      setIsResending(false);
    }
  }, [
    promptPrimeLoginEmailCodeDialog?.email,
    promptPrimeLoginEmailCodeDialog?.verifyUUID,
  ]);

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
    if (isResending) return '发送中...';
    if (countdown > 0) return `重新发送 (${countdown}s)`;
    return '重新发送';
  }, [isResending, countdown]);

  return (
    <Stack>
      <Dialog.Icon icon="BarcodeSolid" />
      <Dialog.Title>Enter verification code</Dialog.Title>
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
        {`Sent to <email>${
          promptPrimeLoginEmailCodeDialog?.email || ''
        }</email>`}
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
          <VerificationCodeInput
            justifyContent="space-between"
            onComplete={(value) => {
              setCode(value);
              Toast.success({
                title: 'code',
                message: value,
              });
            }}
            length={6}
          />
        </YStack>
      </Stack>
      <Dialog.Footer
        showCancelButton={false}
        onConfirmText="Next"
        onConfirm={async ({ preventClose }) => {
          try {
            await backgroundApiProxy.servicePrime.resolvePrimeLoginEmailCodeDialog(
              {
                promiseId,
                code,
              },
            );
          } catch (error) {
            preventClose();
            throw error;
          }
        }}
      />
    </Stack>
  );
}
