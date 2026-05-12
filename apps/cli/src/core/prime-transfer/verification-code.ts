import { buildPrimeTransferVerificationCode } from '@onekeyhq/shared/src/utils/primeTransferVerificationCode';

import { AppError, ERROR_CODES } from '../../errors';

export function buildTransferVerificationCode({
  userId,
  randomNumber,
}: {
  userId: string;
  randomNumber: string;
}): string {
  const userPart = userId.split('--').at(-1) ?? '';
  const verificationCode = buildPrimeTransferVerificationCode({
    userPart,
    randomNumber,
  });

  if (!verificationCode.ok) {
    throw new AppError(
      ERROR_CODES.NET_REQUEST_FAILED.code,
      'App Transfer verification code is unavailable.',
      'Retry the App Transfer login flow',
    );
  }

  return verificationCode.code;
}
