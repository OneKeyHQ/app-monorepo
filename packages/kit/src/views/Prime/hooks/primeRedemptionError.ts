import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IOneKeyAPIBaseResponse } from '@onekeyhq/shared/types/request';

type IPrimeRedemptionErrorPayload = Partial<
  Pick<IOneKeyAPIBaseResponse, 'code' | 'message' | 'translatedMessage'>
>;

export type IPrimeRedemptionErrorPresentation = {
  errorCode: number | undefined;
  isExpiredSession: boolean;
  message: string;
};

function readErrorCode(candidate: unknown): number | undefined {
  return Number.isSafeInteger(candidate) && Number(candidate) > 0
    ? Number(candidate)
    : undefined;
}

function readErrorText(candidate: unknown): string | undefined {
  return typeof candidate === 'string' && candidate ? candidate : undefined;
}

export function getPrimeRedemptionErrorPresentation({
  error,
  fallbackMessage,
}: {
  error: unknown;
  fallbackMessage: string;
}): IPrimeRedemptionErrorPresentation {
  const apiError =
    error && typeof error === 'object'
      ? (error as IOneKeyError<unknown, IPrimeRedemptionErrorPayload>)
      : undefined;
  const payload = apiError?.data;
  return {
    errorCode: readErrorCode(payload?.code ?? apiError?.code),
    isExpiredSession:
      apiError?.key === ETranslations.id_login_expired_description,
    message:
      readErrorText(payload?.translatedMessage) ||
      readErrorText(payload?.message) ||
      readErrorText(apiError?.message) ||
      fallbackMessage,
  };
}
