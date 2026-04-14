import { AppError, ERROR_CODES } from '../../errors';

import { AuthManager } from './auth-manager';

import type { ResolvedAuthSession } from './auth-types';

export const DEFAULT_AUTH_LOGIN_SUGGESTION =
  'Run: onekey auth login --mnemonic';

interface IAuthStatusReader {
  getStatus(): Promise<ResolvedAuthSession>;
}

export async function requireAuthenticatedSession(
  params: {
    authManager?: IAuthStatusReader;
    message?: string;
    suggestion?: string;
  } = {},
): Promise<ResolvedAuthSession> {
  const authManager = params.authManager ?? new AuthManager();
  const session = await authManager.getStatus();

  if (session.authStatus !== 'authenticated') {
    throw new AppError(
      ERROR_CODES.AUTH_NO_WALLET.code,
      params.message ?? 'This command requires an authenticated wallet.',
      params.suggestion ?? DEFAULT_AUTH_LOGIN_SUGGESTION,
    );
  }

  return session;
}
