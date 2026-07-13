import { requireAuthenticatedSession } from '../core/auth/auth-gate';
import { AppError, ERROR_CODES } from '../errors';

export async function requireAuthenticatedCommand(): Promise<void> {
  await requireAuthenticatedSession();
}

export function requireStringOption(
  value: string | undefined,
  optionSpec: string,
): string {
  if (value === undefined) {
    throw new AppError(
      ERROR_CODES.PARAM_MISSING_REQUIRED.code,
      `required option '${optionSpec}' not specified`,
      'Check the input parameters and retry',
    );
  }

  return value;
}
