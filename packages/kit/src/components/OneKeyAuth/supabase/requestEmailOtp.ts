import {
  getSanitizedAuthErrorText,
  logOneKeyIdLoginFailureReason,
} from '@onekeyhq/kit/src/views/Prime/components/oneKeyIdLoginToastUtils';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  getEmailAuthCaptchaErrorMessage,
  isEmailOtpSendKnownFailure,
} from '../emailOtpErrorUtils';
import {
  createEmailOtpRateLimitError,
  parseEmailOtpRateLimitRetryAfterSeconds,
} from '../emailOtpRateLimitError';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { IntlShape } from 'react-intl';

export async function requestEmailOtp({
  client,
  email,
  captchaToken,
  intl,
}: {
  client: { auth: Pick<SupabaseClient['auth'], 'signInWithOtp'> };
  email: string;
  captchaToken?: string;
  intl: IntlShape;
}) {
  const res = await client.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      ...(captchaToken ? { captchaToken } : {}),
    },
  });
  if (res.error && res.error.message) {
    const isEmailOtpSendFailure = isEmailOtpSendKnownFailure(res.error);
    const retryAfterSeconds = parseEmailOtpRateLimitRetryAfterSeconds(
      res.error,
    );
    if (retryAfterSeconds !== undefined) {
      throw createEmailOtpRateLimitError({
        message: intl.formatMessage(
          { id: ETranslations.email_verification_rate_limit },
          { rest: String(retryAfterSeconds) },
        ),
        retryAfterSeconds,
        isEmailOtpSendFailure,
      });
    }
    const error = new OneKeyLocalError({
      message:
        getEmailAuthCaptchaErrorMessage({ error: res.error, intl }) ??
        res.error.message,
      data: { isEmailOtpSendFailure },
    });
    logOneKeyIdLoginFailureReason(
      `OneKey ID email verification code request failed: ${getSanitizedAuthErrorText(res.error)}`,
      error,
    );
    throw error;
  }
  return res;
}
