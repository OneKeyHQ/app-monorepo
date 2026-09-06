import { ETranslations } from '@onekeyhq/shared/src/locale';

type IPrimeRedemptionApiError = {
  code?: unknown;
  data?: {
    code?: unknown;
    message?: unknown;
    translatedMessage?: unknown;
  };
  key?: unknown;
  message?: unknown;
  response?: {
    data?: {
      code?: unknown;
      message?: unknown;
      translatedMessage?: unknown;
    };
  };
};

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
  const apiError = error as IPrimeRedemptionApiError;
  const responseData = apiError.response?.data;
  return {
    errorCode: readErrorCode(
      apiError.data?.code ?? responseData?.code ?? apiError.code,
    ),
    isExpiredSession:
      apiError.key === ETranslations.id_login_expired_description,
    message:
      readErrorText(apiError.data?.translatedMessage) ||
      readErrorText(responseData?.translatedMessage) ||
      readErrorText(apiError.data?.message) ||
      readErrorText(responseData?.message) ||
      readErrorText(apiError.message) ||
      fallbackMessage,
  };
}
