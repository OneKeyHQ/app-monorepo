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
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { usePrimeAuthV2 } from '../../hooks/usePrimeAuthV2';

import type { IPrivyState } from '../../hooks/usePrivyUniversalV2/usePrivyUniversalV2Types';

const COUNTDOWN_TIME = 60;

export function PrimeLoginEmailCodeDialogV2(props: {
  email: string;
  privyState?: IPrivyState;
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
  const isResendingRef = useRef(isResending);
  isResendingRef.current = isResending;
  const [verificationCode, setVerificationCode] = useState('');
  const [state, setState] = useState<{ status: 'initial' | 'error' | 'done' }>({
    status: 'initial',
  });
  const intl = useIntl();
  const { isReady } = usePrimeAuthV2();
  // https://auth.privy.io/api/v1/passwordless/init
  const [isApiReady, setIsApiReady] = useState(false);

  const sendEmailVerificationCode = useCallback(async () => {
    if (isResendingRef.current) {
      return;
    }
    setIsResending(true);
    setState({ status: 'initial' });
    setVerificationCode('');
    try {
      await sendCode({ email });
      setIsApiReady(true);
      setCountdown(COUNTDOWN_TIME);
    } finally {
      setIsResending(false);
    }
    defaultLogger.referral.page.signupOneKeyID();
  }, [email, sendCode]);

  useEffect(() => {
    if (isReady) {
      void sendEmailVerificationCode();
    }

    // await pRetry(
    //   async () => {
    //     await sendCode({ email: data.email });
    //   },
    //   {
    //     retries: 2,
    //     maxTimeout: 10_000,
    //   },
    // );
  }, [isReady, sendEmailVerificationCode]);

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

  const handleConfirm = useCallback(async () => {
    if (onConfirm) {
      onConfirm?.(verificationCode);
      return;
    }
    if (isSubmittingVerificationCode) {
      return;
    }
    setIsSubmittingVerificationCode(true);

    // Toast.success({
    //   title: 'handleConfirm success',
    // });

    try {
      await loginWithCode({
        code: verificationCode,
        email,
      });

      Toast.success({
        title: intl.formatMessage({ id: ETranslations.id_login_success }),
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
        Toast.error({
          title: e?.message,
        });
        void sendEmailVerificationCode();
      } else {
        setState({ status: 'error' });
      }
      defaultLogger.referral.page.signupOneKeyIDResult(false);
    } finally {
      setIsSubmittingVerificationCode(false);
    }
  }, [
    sendEmailVerificationCode,
    onConfirm,
    isSubmittingVerificationCode,
    verificationCode,
    loginWithCode,
    email,
    intl,
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
            disabled={countdown > 0 || isResending || !isApiReady}
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
          disabled: verificationCode.length !== 6 || !isReady || !isApiReady,
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
