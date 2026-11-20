import { ETranslations } from '../locale/enum/translations';

export const PRIME_USER_BANNED_CODE = 90_012;

export const primeUserBannedMessage = {
  id: ETranslations.error__service_prime_user_banned_error,
  defaultMessage: 'This account has been banned.',
};

export function isPrimeUserBannedError(error: unknown): boolean {
  const value = error as {
    code?: unknown;
    data?: { code?: unknown };
    response?: { data?: { code?: unknown } };
  } | null;
  return (
    Number(value?.code) === PRIME_USER_BANNED_CODE ||
    Number(value?.data?.code) === PRIME_USER_BANNED_CODE ||
    Number(value?.response?.data?.code) === PRIME_USER_BANNED_CODE
  );
}
