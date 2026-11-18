import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useIntl } from 'react-intl';

import {
  Alert,
  Button,
  Dialog,
  Input,
  Stack,
  Toast,
  XStack,
} from '@onekeyhq/components';
import CaptchaFrame from '@onekeyhq/kit/src/components/Captcha/CaptchaFrame';
import {
  EmailOtpCaptchaCancelledError,
  useEmailOtpCaptcha,
} from '@onekeyhq/kit/src/components/Captcha/useEmailOtpCaptcha';
import { getEmailOtpRequestErrorMessage } from '@onekeyhq/kit/src/components/OneKeyAuth/emailOtpErrorUtils';
import { useIsMounted } from '@onekeyhq/kit/src/hooks/useIsMounted';
import type { IEmailOtpCaptchaConfig } from '@onekeyhq/shared/src/consts/authConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function PrimeLoginPasswordTestDialog({
  active,
  email,
  captchaConfig,
  revision,
  disabled,
  loginWithPassword,
  onLoginSuccess,
  onChooseAnotherSignInMethod,
  developmentControls,
}: {
  active: boolean;
  email: string;
  captchaConfig: IEmailOtpCaptchaConfig;
  revision: number;
  disabled: boolean;
  loginWithPassword: (args: {
    email: string;
    password: string;
    captchaToken?: string;
  }) => Promise<void>;
  onLoginSuccess: () => void | Promise<void>;
  onChooseAnotherSignInMethod: () => void | Promise<void>;
  developmentControls: (
    disabled: boolean,
    authActionPending?: boolean,
  ) => ReactNode;
}) {
  const intl = useIntl();
  const mounted = useIsMounted();
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);
  const attemptRef = useRef<object | undefined>(undefined);
  const {
    challenge,
    onResult,
    takeCaptchaToken,
    cancelCaptcha,
    isWaiting,
    errorMessage,
  } = useEmailOtpCaptcha({ config: captchaConfig, active, email, revision });

  useEffect(() => {
    setPassword('');
    setSubmitting(false);
    setComplete(false);
    return () => {
      attemptRef.current = undefined;
      cancelCaptcha();
    };
  }, [active, email, revision, cancelCaptcha]);

  const handleConfirm = useCallback(async () => {
    if (
      !active ||
      disabled ||
      complete ||
      !password.length ||
      attemptRef.current
    )
      return;
    const attempt = {};
    attemptRef.current = attempt;
    setSubmitting(true);
    try {
      const captchaToken = await takeCaptchaToken();
      if (!mounted.current || attemptRef.current !== attempt) return;
      await loginWithPassword({
        email,
        password,
        ...(captchaToken ? { captchaToken } : {}),
      });
      if (!mounted.current || attemptRef.current !== attempt) return;
      setPassword('');
      setComplete(true);
      await onLoginSuccess();
    } catch (error) {
      if (
        !mounted.current ||
        attemptRef.current !== attempt ||
        error instanceof EmailOtpCaptchaCancelledError
      )
        return;
      const title = getEmailOtpRequestErrorMessage({ error, intl });
      if (title) Toast.error({ title });
    } finally {
      if (attemptRef.current === attempt) {
        attemptRef.current = undefined;
        if (mounted.current) setSubmitting(false);
      }
    }
  }, [
    active,
    complete,
    disabled,
    email,
    intl,
    loginWithPassword,
    mounted,
    onLoginSuccess,
    password,
    takeCaptchaToken,
  ]);

  const handleChooseAnotherSignInMethod = useCallback(async () => {
    if (submitting && !isWaiting) return;
    attemptRef.current = undefined;
    cancelCaptcha();
    setPassword('');
    setSubmitting(false);
    await onChooseAnotherSignInMethod();
  }, [cancelCaptcha, isWaiting, onChooseAnotherSignInMethod, submitting]);

  if (!active) return null;
  const cannotSubmit = disabled || submitting || complete || !password.length;
  const requestInFlight = submitting && !isWaiting;

  return (
    <Stack>
      <Dialog.Header>
        <Dialog.Icon icon="LockOutline" />
        <Dialog.Title>
          {intl.formatMessage({ id: ETranslations.auth_enter_your_password })}
        </Dialog.Title>
        <Dialog.Description>{email}</Dialog.Description>
      </Dialog.Header>
      <Input
        testID="prime-otp-code"
        autoFocus
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="default"
        placeholder={intl.formatMessage({
          id: ETranslations.auth_enter_your_password,
        })}
        value={password}
        disabled={submitting || complete}
        onChangeText={setPassword}
      />
      <Dialog.Footer
        showCancelButton={false}
        confirmButtonProps={{ loading: submitting, disabled: cannotSubmit }}
        onConfirmText={intl.formatMessage({ id: ETranslations.global_next })}
        onConfirm={async ({ preventClose }) => {
          preventClose();
          await handleConfirm();
        }}
        extraContent={
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
            {errorMessage ? (
              <Stack px="$5" pb="$5">
                <Alert
                  type="critical"
                  icon="ErrorOutline"
                  description={errorMessage}
                  action={{
                    primary: intl.formatMessage({
                      id: ETranslations.global_retry,
                    }),
                    isPrimaryDisabled: cannotSubmit,
                    onPrimaryPress: handleConfirm,
                  }}
                />
              </Stack>
            ) : null}
            <XStack justifyContent="center" px="$5" pb="$5">
              <Button
                testID="prime-choose-another-sign-in-method-btn"
                variant="tertiary"
                disabled={requestInFlight || complete}
                onPress={handleChooseAnotherSignInMethod}
              >
                {intl.formatMessage({
                  id: ETranslations.choose_another_sign_in_method__action,
                })}
              </Button>
            </XStack>
            <Stack px="$5" pb="$5">
              {developmentControls(requestInFlight, submitting)}
            </Stack>
          </>
        }
      />
    </Stack>
  );
}
