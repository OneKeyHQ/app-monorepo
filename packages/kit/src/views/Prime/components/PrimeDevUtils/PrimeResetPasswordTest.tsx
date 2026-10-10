import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { Alert, Button, Stack, Toast } from '@onekeyhq/components';
import CaptchaFrame from '@onekeyhq/kit/src/components/Captcha/CaptchaFrame';
import {
  EmailOtpCaptchaCancelledError,
  useEmailOtpCaptcha,
} from '@onekeyhq/kit/src/components/Captcha/useEmailOtpCaptcha';
import { getEmailOtpRequestErrorMessage } from '@onekeyhq/kit/src/components/OneKeyAuth/emailOtpErrorUtils';
import { useIsMounted } from '@onekeyhq/kit/src/hooks/useIsMounted';
import type { IEmailOtpCaptchaConfig } from '@onekeyhq/shared/src/consts/authConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import type { SupabaseClient } from '@supabase/supabase-js';

export function PrimeResetPasswordTest({
  email,
  captchaConfig,
  revision,
  disabled,
  createClient,
  onBusyChange,
}: {
  email: string;
  captchaConfig: IEmailOtpCaptchaConfig;
  revision: number;
  disabled: boolean;
  createClient: () => SupabaseClient;
  onBusyChange: (busy: boolean) => void;
}) {
  const intl = useIntl();
  const mounted = useIsMounted();
  const [submitting, setSubmitting] = useState(false);
  const attemptRef = useRef<object | undefined>(undefined);
  const { challenge, onResult, takeCaptchaToken, cancelCaptcha, errorMessage } =
    useEmailOtpCaptcha({ config: captchaConfig, email, revision });

  useEffect(
    () => () => {
      if (attemptRef.current) {
        attemptRef.current = undefined;
        onBusyChange(false);
      }
      cancelCaptcha();
      if (mounted.current) setSubmitting(false);
    },
    [email, revision, createClient, cancelCaptcha, mounted, onBusyChange],
  );

  const handleReset = useCallback(async () => {
    if (disabled || !stringUtils.isValidEmail(email) || attemptRef.current)
      return;
    const attempt = {};
    attemptRef.current = attempt;
    setSubmitting(true);
    onBusyChange(true);
    try {
      const captchaToken = await takeCaptchaToken();
      if (!mounted.current || attemptRef.current !== attempt) return;
      const { error } = await createClient().auth.resetPasswordForEmail(
        email,
        captchaToken ? { captchaToken } : {},
      );
      if (!mounted.current || attemptRef.current !== attempt) return;
      if (error) throw error;
      Toast.success({ title: 'Password reset request accepted.' });
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
        onBusyChange(false);
        if (mounted.current) setSubmitting(false);
      }
    }
  }, [
    disabled,
    email,
    onBusyChange,
    takeCaptchaToken,
    mounted,
    createClient,
    intl,
  ]);

  const cannotSubmit =
    disabled || submitting || !stringUtils.isValidEmail(email);
  return (
    <Stack gap="$2">
      <Button
        testID="prime-otp-reset-password"
        size="small"
        variant="secondary"
        loading={submitting}
        disabled={cannotSubmit}
        onPress={handleReset}
      >
        Reset password
      </Button>
      {challenge ? (
        <CaptchaFrame
          key={challenge.requestId}
          {...challenge}
          onResult={onResult}
        />
      ) : null}
      {errorMessage ? (
        <Alert
          type="critical"
          icon="ErrorOutline"
          description={errorMessage}
          action={{
            primary: intl.formatMessage({ id: ETranslations.global_retry }),
            primaryTestID: 'prime-otp-reset-password-retry',
            isPrimaryDisabled: cannotSubmit,
            onPrimaryPress: handleReset,
          }}
        />
      ) : null}
    </Stack>
  );
}
