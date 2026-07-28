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
import { getEmailOtpRequestErrorMessage } from '@onekeyhq/kit/src/components/OneKeyAuth/emailOtpErrorUtils';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import { useIsMounted } from '@onekeyhq/kit/src/hooks/useIsMounted';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EMAIL_OTP_COUNTDOWN_SECONDS } from '@onekeyhq/shared/src/consts/authConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { isTransientNetworkLikeError } from '@onekeyhq/shared/src/utils/transientNetworkErrorUtils';

import { getSanitizedAuthErrorText } from '../oneKeyIdLoginToastUtils';
import { DevOTPAutoFill } from '../PrimeDevUtils/DevOTPAutoFill';

export function PrimeLoginEmailCodeDialogV2(props: {
  active?: boolean;
  email: string;
  sendCode: (args: { email: string }) => Promise<void>;
  loginWithCode: (args: { code: string; email: string }) => Promise<void>;
  onLoginSuccess?: () => void | Promise<void>;
  onConfirm?: (code: string) => void | Promise<void>;
  onChooseAnotherSignInMethod?: () => void | Promise<void>;
}) {
  const {
    active = true,
    email,
    sendCode,
    loginWithCode,
    onLoginSuccess,
    onConfirm,
    onChooseAnotherSignInMethod,
  } = props;
  const [devSettings] = useDevSettingsPersistAtom();
  const [isSubmittingVerificationCode, setIsSubmittingVerificationCode] =
    useState(false);
  const [countdown, setCountdown] = useState(EMAIL_OTP_COUNTDOWN_SECONDS);
  const [isResending, setIsResending] = useState(false);
  const isAuthActionInProgressRef = useRef(false);
  const didRequestInitialCodeRef = useRef(false);
  const didSendCodeSucceedRef = useRef(false);
  const isMountedRef = useIsMounted();
  const [verificationCode, setVerificationCode] = useState('');
  const [state, setState] = useState<{
    status: 'initial' | 'error' | 'done';
    errorMessageId?: ETranslations;
  }>({
    status: 'initial',
  });
  const intl = useIntl();
  const { isReady } = useOneKeyAuth();
  const [isApiReady, setIsApiReady] = useState(false);

  const sendEmailVerificationCode = useCallback(async () => {
    if (isAuthActionInProgressRef.current) {
      return;
    }
    isAuthActionInProgressRef.current = true;
    setIsResending(true);
    setState({ status: 'initial' });
    setVerificationCode('');
    try {
      await sendCode({ email });
      didSendCodeSucceedRef.current = true;
      // Re-assert the one-shot guard: if the user left the step while this
      // send was in flight, the re-arm effect below has already reset it,
      // and re-entering must not auto-send a second code.
      didRequestInitialCodeRef.current = true;
      if (!isMountedRef.current) {
        return;
      }
      setIsApiReady(true);
      setCountdown(EMAIL_OTP_COUNTDOWN_SECONDS);
    } catch (error) {
      if (!isMountedRef.current) {
        return;
      }
      console.error(
        'Prime email verification code request failed:',
        getSanitizedAuthErrorText(error),
      );
      const errorMessage = getEmailOtpRequestErrorMessage({ error, intl });
      if (errorMessage) {
        Toast.error({ title: errorMessage });
      }
      setIsApiReady(true);
      setState({ status: 'initial' });
      setCountdown(0);
      return;
    } finally {
      if (isMountedRef.current) {
        setIsResending(false);
      }
      isAuthActionInProgressRef.current = false;
    }
    defaultLogger.referral.page.signupOneKeyID();
  }, [email, intl, isMountedRef, sendCode]);

  useEffect(() => {
    if (active && isReady && !didRequestInitialCodeRef.current) {
      didRequestInitialCodeRef.current = true;
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
  }, [active, isReady, sendEmailVerificationCode]);

  useEffect(() => {
    // Re-arm the initial request when the step is left without any code ever
    // having been delivered (e.g. the send failed offline): the step claims
    // "Sent to {email}" on re-entry, so re-entering it must actually send one.
    // Reset only while inactive so a failed send while the step is visible
    // still requires an explicit Resend press.
    if (!active && !didSendCodeSucceedRef.current) {
      didRequestInitialCodeRef.current = false;
    }
  }, [active]);

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
      return intl.formatMessage(
        { id: ETranslations.resend_code_countdown__action },
        { seconds: countdown },
      );
    }

    return intl.formatMessage({ id: ETranslations.prime_code_resend });
  }, [intl, countdown, isApiReady]);

  const handleConfirm = useCallback(async () => {
    if (
      isAuthActionInProgressRef.current ||
      isSubmittingVerificationCode ||
      state.status === 'done'
    ) {
      return;
    }
    isAuthActionInProgressRef.current = true;
    setIsSubmittingVerificationCode(true);

    // Toast.success({
    //   title: 'handleConfirm success',
    // });

    try {
      if (onConfirm) {
        await onConfirm(verificationCode);
        return;
      }

      // Stage 1: OTP verification (Supabase verifyOtp). Only a failure here
      // is allowed to render as "invalid verification code".
      try {
        await loginWithCode({
          code: verificationCode,
          email,
        });
      } catch (error) {
        console.error(
          'Prime email login failed:',
          getSanitizedAuthErrorText(error),
        );
        defaultLogger.referral.page.signupOneKeyIDResult(false);
        if (!isMountedRef.current) {
          return;
        }
        // A transient infrastructure failure (network down, 5xx, timeout,
        // rate limit) says nothing about the code and does not consume it;
        // keep the input usable so resubmitting the same code can succeed.
        if (isTransientNetworkLikeError(error)) {
          setState({
            status: 'initial',
            errorMessageId: ETranslations.global_network_error,
          });
        } else {
          setState({
            status: 'error',
            errorMessageId: ETranslations.prime_invalid_verification_code,
          });
        }
        return;
      }

      // The bg runtime has committed the login at this point, even if the
      // dialog was dismissed while verification was in flight. Run every
      // success continuation (toast, dialog close, bind prompt, navigation)
      // regardless of mount state — skipping them would leave the app
      // silently logged in with the flow reported as cancelled. Only the
      // local state update needs the mount guard.
      if (isMountedRef.current) {
        setState({ status: 'done' });
      }
      defaultLogger.referral.page.signupOneKeyIDResult(true);

      // Stage 2: post-login UI continuations. The OTP is already consumed and
      // the bg runtime has committed the login, so a failure here must never
      // render as "invalid verification code" — retyping the same code can
      // only fail and reinforces the wrong diagnosis.
      try {
        await onLoginSuccess?.();
      } catch (error) {
        console.error(
          'Prime email post-login continuation failed:',
          getSanitizedAuthErrorText(error),
        );
        // The OTP has already been consumed and the bg runtime has committed
        // the OneKey ID login. Keep this step completed even if closing the
        // host dialog or another post-login continuation fails.
      }
    } finally {
      isAuthActionInProgressRef.current = false;
      if (isMountedRef.current) {
        setIsSubmittingVerificationCode(false);
      }
    }
  }, [
    onConfirm,
    isSubmittingVerificationCode,
    isMountedRef,
    verificationCode,
    loginWithCode,
    email,
    onLoginSuccess,
    state.status,
  ]);

  const handleChooseAnotherSignInMethod = useCallback(async () => {
    if (
      !onChooseAnotherSignInMethod ||
      isAuthActionInProgressRef.current ||
      isSubmittingVerificationCode ||
      state.status === 'done'
    ) {
      return;
    }
    isAuthActionInProgressRef.current = true;
    try {
      setVerificationCode('');
      setState({ status: 'initial' });
      await onChooseAnotherSignInMethod();
    } finally {
      isAuthActionInProgressRef.current = false;
    }
  }, [isSubmittingVerificationCode, onChooseAnotherSignInMethod, state.status]);

  // useEffect(() => {
  //   if (verificationCode.length === 6 && !isSubmittingVerificationCode) {
  //     void handleConfirm();
  //   }
  // }, [verificationCode, handleConfirm, isSubmittingVerificationCode]);

  if (!active) {
    return null;
  }

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
            testID="prime-btn"
            width="auto"
            size="small"
            variant="tertiary"
            disabled={
              countdown > 0 ||
              isResending ||
              !isApiReady ||
              state.status === 'done'
            }
            onPress={sendEmailVerificationCode}
          >
            {buttonText}
          </Button>
        </XStack>

        <OTPInput
          autoFocus
          status={state.status === 'error' ? 'error' : 'normal'}
          numberOfDigits={6}
          disabled={state.status === 'done'}
          value={verificationCode}
          onTextChange={(value) => {
            setVerificationCode(value);
            setState({ status: 'initial' });
          }}
        />

        {devSettings.enabled ? <DevOTPAutoFill email={email} /> : null}

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
          loading: isSubmittingVerificationCode,
          disabled:
            verificationCode.length !== 6 ||
            !isReady ||
            !isApiReady ||
            state.status === 'done',
        }}
        onConfirmText={intl.formatMessage({
          id: ETranslations.global_next,
        })}
        onConfirm={async ({ preventClose }) => {
          preventClose();
          await handleConfirm();
        }}
        extraContent={
          onChooseAnotherSignInMethod ? (
            <XStack justifyContent="center" px="$5" pb="$5">
              <Button
                testID="prime-choose-another-sign-in-method-btn"
                variant="tertiary"
                size="medium"
                disabled={
                  isSubmittingVerificationCode ||
                  isResending ||
                  state.status === 'done'
                }
                onPress={handleChooseAnotherSignInMethod}
              >
                {intl.formatMessage({
                  id: ETranslations.choose_another_sign_in_method__action,
                })}
              </Button>
            </XStack>
          ) : undefined
        }
      />
    </Stack>
  );
}
