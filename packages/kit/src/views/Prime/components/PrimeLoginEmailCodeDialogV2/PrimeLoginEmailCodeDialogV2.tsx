import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useIntl } from 'react-intl';

import {
  Alert,
  Button,
  Dialog,
  Icon,
  Input,
  SizableText,
  Stack,
  Toast,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import type { IInputRef } from '@onekeyhq/components';
import CaptchaFrame from '@onekeyhq/kit/src/components/Captcha/CaptchaFrame';
import {
  EmailOtpCaptchaCancelledError,
  useEmailOtpCaptcha,
} from '@onekeyhq/kit/src/components/Captcha/useEmailOtpCaptcha';
import {
  getEmailOtpRequestErrorMessage,
  isEmailOtpSendKnownFailure,
} from '@onekeyhq/kit/src/components/OneKeyAuth/emailOtpErrorUtils';
import { getEmailOtpRateLimitRetryAfterSeconds } from '@onekeyhq/kit/src/components/OneKeyAuth/emailOtpRateLimitError';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import { useIsMounted } from '@onekeyhq/kit/src/hooks/useIsMounted';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EMAIL_OTP_COUNTDOWN_SECONDS } from '@onekeyhq/shared/src/consts/authConsts';
import type { IEmailOtpCaptchaConfig } from '@onekeyhq/shared/src/consts/authConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { isTransientNetworkLikeError } from '@onekeyhq/shared/src/utils/transientNetworkErrorUtils';

import {
  getSanitizedAuthErrorText,
  logOneKeyIdLoginFailureReason,
  wasOneKeyIdFailureServerLogged,
} from '../oneKeyIdLoginToastUtils';
import { DevOTPAutoFill } from '../PrimeDevUtils/DevOTPAutoFill';

type IEmailOtpSendAttempt = {
  stage: 'captcha' | 'sending';
  allowPreviousCode: boolean;
};

export function PrimeLoginEmailCodeDialogV2(props: {
  active?: boolean;
  developmentControls?: (disabled: boolean) => ReactNode;
  captchaConfig?: IEmailOtpCaptchaConfig;
  developmentConfigRevision?: number;
  sendCodeDisabled?: boolean;
  isolatedTest?: boolean;
  email: string;
  sendCode: (args: { email: string; captchaToken?: string }) => Promise<void>;
  loginWithCode: (args: { code: string; email: string }) => Promise<void>;
  onLoginSuccess?: () => void | Promise<void>;
  onConfirm?: (code: string) => void | Promise<void>;
  onChooseAnotherSignInMethod?: () => void | Promise<void>;
}) {
  const {
    active = true,
    developmentControls,
    captchaConfig,
    developmentConfigRevision = 0,
    sendCodeDisabled = false,
    isolatedTest = false,
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
  const [isCodeInputEnabled, setIsCodeInputEnabled] = useState(false);
  const codeInputRef = useRef<IInputRef>(null);
  const isAuthActionInProgressRef = useRef(false);
  const sendAttemptRef = useRef<IEmailOtpSendAttempt | undefined>(undefined);
  const didRequestInitialCodeRef = useRef(false);
  const previousDevelopmentRevision = useRef(developmentConfigRevision);
  const didSendCodeSucceedRef = useRef(false);
  const isMountedRef = useIsMounted();
  const [verificationCode, setVerificationCode] = useState('');
  const isVerificationCodeValid = /^\d+$/.test(verificationCode);
  const [state, setState] = useState<{
    status: 'initial' | 'error' | 'done';
    errorMessageId?: ETranslations;
  }>({
    status: 'initial',
  });
  const intl = useIntl();
  const { copyText } = useClipboard();
  const { isReady } = useOneKeyAuth();
  const [isApiReady, setIsApiReady] = useState(false);
  const {
    challenge,
    onResult,
    takeCaptchaToken,
    cancelCaptcha,
    isWaiting,
    errorMessage: captchaErrorMessage,
  } = useEmailOtpCaptcha({
    config: captchaConfig,
    active,
    email,
    revision: developmentConfigRevision,
  });

  useEffect(() => {
    if (active && isCodeInputEnabled) codeInputRef.current?.focus();
  }, [active, isCodeInputEnabled]);

  const cancelPendingCaptchaSend = useCallback(() => {
    const attempt = sendAttemptRef.current;
    if (attempt?.stage !== 'captcha') return;
    sendAttemptRef.current = undefined;
    isAuthActionInProgressRef.current = false;
    cancelCaptcha();
    if (isMountedRef.current) {
      setIsResending(false);
      setIsCodeInputEnabled(attempt.allowPreviousCode);
      setIsApiReady(true);
      if (!didSendCodeSucceedRef.current) setCountdown(0);
    }
  }, [cancelCaptcha, isMountedRef]);

  useEffect(
    () => () => {
      // Also re-arm after React's development effect replay, before a token
      // has been consumed. A configuration change below still requires Resend.
      if (sendAttemptRef.current?.stage === 'captcha') {
        if (!didSendCodeSucceedRef.current)
          didRequestInitialCodeRef.current = false;
        cancelPendingCaptchaSend();
      }
    },
    [
      active,
      email,
      captchaConfig?.enabled,
      captchaConfig?.pageUrl,
      developmentConfigRevision,
      cancelPendingCaptchaSend,
    ],
  );

  const handleCopyEmailSender = useCallback(() => {
    copyText('OneKey');
  }, [copyText]);

  const sendEmailVerificationCode = useCallback(async () => {
    if (isAuthActionInProgressRef.current) {
      return;
    }
    isAuthActionInProgressRef.current = true;
    const attempt: IEmailOtpSendAttempt = {
      stage: 'captcha',
      allowPreviousCode: isCodeInputEnabled,
    };
    sendAttemptRef.current = attempt;
    setIsResending(true);
    setIsCodeInputEnabled(false);
    setState({ status: 'initial' });
    setVerificationCode('');
    try {
      const captchaToken = await takeCaptchaToken();
      if (sendAttemptRef.current !== attempt || !isMountedRef.current) return;
      attempt.stage = 'sending';
      await sendCode({ email, ...(captchaToken ? { captchaToken } : {}) });
      didSendCodeSucceedRef.current = true;
      // Re-assert the one-shot guard: if the user left the step while this
      // send was in flight, the re-arm effect below has already reset it,
      // and re-entering must not auto-send a second code.
      didRequestInitialCodeRef.current = true;
      if (!isMountedRef.current) {
        return;
      }
      setIsApiReady(true);
      setIsCodeInputEnabled(true);
      setCountdown(EMAIL_OTP_COUNTDOWN_SECONDS);
    } catch (error) {
      // Leaving the CAPTCHA step or changing its target is not a login failure.
      if (
        error instanceof EmailOtpCaptchaCancelledError ||
        sendAttemptRef.current !== attempt
      )
        return;
      logOneKeyIdLoginFailureReason(
        `Prime email verification code request failed: ${getSanitizedAuthErrorText(
          error,
        )}`,
        error,
      );
      if (!isMountedRef.current) {
        return;
      }
      const retryAfterSeconds = getEmailOtpRateLimitRetryAfterSeconds(error);
      const errorMessage = getEmailOtpRequestErrorMessage({ error, intl });
      if (errorMessage) {
        Toast.error({ title: errorMessage });
      }
      setIsApiReady(true);
      // Block known send failures, but let users submit after unknown errors.
      // A failed resend does not invalidate a previously requested code.
      setIsCodeInputEnabled(
        attempt.allowPreviousCode ||
          (attempt.stage === 'sending' && !isEmailOtpSendKnownFailure(error)),
      );
      setState({ status: 'initial' });
      setCountdown(retryAfterSeconds ?? 0);
      return;
    } finally {
      if (sendAttemptRef.current === attempt) {
        sendAttemptRef.current = undefined;
        if (isMountedRef.current) setIsResending(false);
        isAuthActionInProgressRef.current = false;
      }
    }
    if (!isolatedTest) defaultLogger.referral.page.signupOneKeyID();
  }, [
    email,
    intl,
    isCodeInputEnabled,
    isMountedRef,
    isolatedTest,
    sendCode,
    takeCaptchaToken,
  ]);

  useEffect(() => {
    if (previousDevelopmentRevision.current === developmentConfigRevision)
      return;
    previousDevelopmentRevision.current = developmentConfigRevision;
    didRequestInitialCodeRef.current = true;
    didSendCodeSucceedRef.current = false;
    setIsCodeInputEnabled(false);
    setVerificationCode('');
    setState({ status: 'initial' });
    setIsApiReady(true);
    setCountdown(0);
  }, [developmentConfigRevision]);

  useEffect(() => {
    if (
      active &&
      isReady &&
      !sendCodeDisabled &&
      !didRequestInitialCodeRef.current
    ) {
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
  }, [active, isReady, sendCodeDisabled, sendEmailVerificationCode]);

  useEffect(() => {
    // Re-arm the initial request when the step is left without any code ever
    // having been delivered (e.g. the send failed offline): the step claims
    // "Sent to {email}" on re-entry, so re-entering it must actually send one.
    // Reset only while inactive so a failed send while the step is visible
    // still requires an explicit Resend press.
    if (!active && countdown <= 0 && !didSendCodeSucceedRef.current) {
      didRequestInitialCodeRef.current = false;
    }
  }, [active, countdown]);

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
    if (!isApiReady || isResending) {
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
  }, [intl, countdown, isApiReady, isResending]);

  const handleConfirm = useCallback(async () => {
    if (
      isAuthActionInProgressRef.current ||
      isSubmittingVerificationCode ||
      !isCodeInputEnabled ||
      !isVerificationCodeValid ||
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
        // Background-owned failures carry a serialized marker across RPC.
        // Bridge/call failures that never reached the background still need
        // one UI-side diagnostic event.
        if (!wasOneKeyIdFailureServerLogged(error)) {
          logOneKeyIdLoginFailureReason(
            `Prime email OTP login failed before background diagnostics: ${getSanitizedAuthErrorText(
              error,
            )}`,
            error,
          );
        }
        if (!isolatedTest)
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
      if (!isolatedTest) defaultLogger.referral.page.signupOneKeyIDResult(true);

      // Stage 2: post-login UI continuations. The OTP is already consumed and
      // the bg runtime has committed the login, so a failure here must never
      // render as "invalid verification code" — retyping the same code can
      // only fail and reinforces the wrong diagnosis.
      try {
        await onLoginSuccess?.();
      } catch (error) {
        logOneKeyIdLoginFailureReason(
          `Prime email post-login continuation failed: ${getSanitizedAuthErrorText(
            error,
          )}`,
          error,
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
    isCodeInputEnabled,
    isMountedRef,
    isolatedTest,
    isVerificationCodeValid,
    verificationCode,
    loginWithCode,
    email,
    onLoginSuccess,
    state.status,
  ]);

  const handleChooseAnotherSignInMethod = useCallback(async () => {
    if (
      !onChooseAnotherSignInMethod ||
      (isAuthActionInProgressRef.current &&
        sendAttemptRef.current?.stage !== 'captcha') ||
      isSubmittingVerificationCode ||
      state.status === 'done'
    ) {
      return;
    }
    cancelPendingCaptchaSend();
    isAuthActionInProgressRef.current = true;
    try {
      setVerificationCode('');
      setState({ status: 'initial' });
      await onChooseAnotherSignInMethod();
    } finally {
      isAuthActionInProgressRef.current = false;
    }
  }, [
    cancelPendingCaptchaSend,
    isSubmittingVerificationCode,
    onChooseAnotherSignInMethod,
    state.status,
  ]);

  if (!active) {
    return null;
  }

  const developmentPanel = developmentControls?.(
    (isResending && !isWaiting) || isSubmittingVerificationCode,
  );

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
          {didSendCodeSucceedRef.current
            ? intl.formatMessage({ id: ETranslations.prime_sent_to }, { email })
            : email}
        </Dialog.Description>
      </Dialog.Header>

      <YStack gap="$2">
        <Alert
          type="info"
          icon="InfoCircleOutline"
          borderWidth={0}
          alignItems="flex-start"
          descriptionComponent={
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage(
                {
                  id: ETranslations.onekey_id_verification_email_hint__desc,
                },
                {
                  onekey: (chunks: ReactNode[]) => (
                    <SizableText
                      testID="prime-login-email-sender-copy"
                      size="$bodyMdMedium"
                      color="$text"
                      cursor="pointer"
                      hoverStyle={{ opacity: 0.8 }}
                      pressStyle={{ opacity: 0.6 }}
                      role="button"
                      onPress={handleCopyEmailSender}
                    >
                      {chunks}
                      {'\u00A0'}
                      <Icon
                        name="Copy3Outline"
                        size="$3.5"
                        color="$iconSubdued"
                        pointerEvents="none"
                        transform={[{ translateY: 2 }]}
                      />
                    </SizableText>
                  ),
                },
              )}
            </SizableText>
          }
        />

        <XStack>
          <Button
            testID="prime-btn"
            width="auto"
            size="small"
            variant="tertiary"
            disabled={
              countdown > 0 ||
              sendCodeDisabled ||
              isResending ||
              !isApiReady ||
              state.status === 'done'
            }
            onPress={sendEmailVerificationCode}
          >
            {buttonText}
          </Button>
        </XStack>

        <Input
          ref={codeInputRef}
          testID="prime-otp-code"
          placeholder={intl.formatMessage({
            id: ETranslations.prime_enter_verification_code,
          })}
          error={state.status === 'error'}
          keyboardType="number-pad"
          disabled={!isCodeInputEnabled || state.status === 'done'}
          value={verificationCode}
          onChangeText={(value) => {
            if (!isCodeInputEnabled || state.status === 'done') return;
            setVerificationCode(value.replace(/[^0-9]/g, ''));
            setState({ status: 'initial' });
          }}
        />

        {devSettings.enabled && !isolatedTest ? (
          <DevOTPAutoFill email={email} />
        ) : null}

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
            !isCodeInputEnabled ||
            !isVerificationCodeValid ||
            !isReady ||
            !isApiReady ||
            isResending ||
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
          challenge ||
          captchaErrorMessage ||
          onChooseAnotherSignInMethod ||
          developmentPanel ? (
            <>
              {challenge ? (
                <Stack px="$5" pb="$5">
                  <CaptchaFrame
                    key={challenge.requestId}
                    {...challenge}
                    onResult={onResult}
                  />
                </Stack>
              ) : null}
              {captchaErrorMessage ? (
                <Stack px="$5" pb="$5">
                  <Alert
                    testID="email-otp-captcha-error"
                    type="critical"
                    icon="ErrorOutline"
                    description={captchaErrorMessage}
                    action={{
                      primary: intl.formatMessage({
                        id: ETranslations.global_retry,
                      }),
                      primaryTestID: 'email-otp-captcha-retry',
                      isPrimaryDisabled:
                        sendCodeDisabled ||
                        isResending ||
                        isSubmittingVerificationCode ||
                        state.status === 'done',
                      onPrimaryPress: sendEmailVerificationCode,
                    }}
                  />
                </Stack>
              ) : null}
              {onChooseAnotherSignInMethod ? (
                <XStack justifyContent="center" px="$5" pb="$5">
                  <Button
                    testID="prime-choose-another-sign-in-method-btn"
                    variant="tertiary"
                    size="medium"
                    disabled={
                      isSubmittingVerificationCode ||
                      (isResending && !isWaiting) ||
                      state.status === 'done'
                    }
                    onPress={handleChooseAnotherSignInMethod}
                  >
                    {intl.formatMessage({
                      id: ETranslations.choose_another_sign_in_method__action,
                    })}
                  </Button>
                </XStack>
              ) : null}
              {developmentPanel ? (
                <Stack px="$5" pb="$5">
                  {developmentPanel}
                </Stack>
              ) : null}
            </>
          ) : undefined
        }
      />
    </Stack>
  );
}
