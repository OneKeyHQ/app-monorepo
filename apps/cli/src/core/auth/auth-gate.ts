import { CliAuthManager } from '../../commands/auth/_internal/cli-auth-manager';
import { AppError, ERROR_CODES } from '../../errors';

import type { ResolvedAuthSession } from './auth-types';

export const DEFAULT_AUTH_LOGIN_SUGGESTION =
  'Run: onekey auth login --app-transfer';

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
  // Default to the CliAuthManager facade so this gate recognizes BOTH the
  // vault-backed app-transfer login (BotWalletAuthManager) and the
  // session.json + keychain-pair hardware login (HardwareAuthManager).
  // Picking one in isolation reintroduces the split-brain bug where
  // `auth status` and downstream commands disagree about authentication.
  const authManager = params.authManager ?? new CliAuthManager();
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
