import { EMAIL_OTP_COUNTDOWN_SECONDS } from '@onekeyhq/shared/src/consts/authConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';

const EMAIL_OTP_RATE_LIMIT_ERROR_CODE = 'over_email_send_rate_limit';
const EMAIL_OTP_RATE_LIMIT_ERROR_TYPE = 'emailOtpRateLimit';
const EMAIL_OTP_RATE_LIMIT_MESSAGE_PREFIX =
  'For security purposes, you can only request this after';
const EMAIL_OTP_RATE_LIMIT_SECONDS_PATTERN =
  /you can only request this after (\d+) seconds?/i;

type IEmailOtpRateLimitErrorData = {
  type: typeof EMAIL_OTP_RATE_LIMIT_ERROR_TYPE;
  retryAfterSeconds: number;
};

export function parseEmailOtpRateLimitRetryAfterSeconds(error: {
  code?: unknown;
  message?: unknown;
}): number | undefined {
  const message = typeof error.message === 'string' ? error.message : '';
  const isEmailOtpRateLimit =
    error.code === EMAIL_OTP_RATE_LIMIT_ERROR_CODE ||
    message.includes(EMAIL_OTP_RATE_LIMIT_MESSAGE_PREFIX);
  if (!isEmailOtpRateLimit) {
    return undefined;
  }

  const secondsMatch = message.match(EMAIL_OTP_RATE_LIMIT_SECONDS_PATTERN);
  const parsedSeconds = Number(secondsMatch?.[1]);
  if (
    secondsMatch &&
    Number.isSafeInteger(parsedSeconds) &&
    parsedSeconds >= 0
  ) {
    return parsedSeconds;
  }

  return EMAIL_OTP_COUNTDOWN_SECONDS;
}

export function createEmailOtpRateLimitError({
  message,
  retryAfterSeconds,
}: {
  message: string;
  retryAfterSeconds: number;
}) {
  return new OneKeyLocalError<unknown, IEmailOtpRateLimitErrorData>({
    message,
    key: ETranslations.email_verification_rate_limit,
    info: { rest: String(retryAfterSeconds) },
    data: {
      type: EMAIL_OTP_RATE_LIMIT_ERROR_TYPE,
      retryAfterSeconds,
    },
  });
}

export function getEmailOtpRateLimitRetryAfterSeconds(
  error: unknown,
): number | undefined {
  const data = (
    error as
      | {
          data?: Partial<IEmailOtpRateLimitErrorData>;
        }
      | undefined
  )?.data;
  if (data?.type !== EMAIL_OTP_RATE_LIMIT_ERROR_TYPE) {
    return undefined;
  }

  const retryAfterSeconds = data.retryAfterSeconds;
  if (
    typeof retryAfterSeconds !== 'number' ||
    !Number.isSafeInteger(retryAfterSeconds) ||
    retryAfterSeconds < 0
  ) {
    return undefined;
  }

  return retryAfterSeconds;
}
