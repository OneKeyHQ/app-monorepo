import { AuthManager } from '../../core/auth/auth-manager';
import { AppError, ERROR_CODES } from '../../errors';
import { presentAuthLogoutResult } from '../../output/auth-presenters';

import { readConfirmation } from './auth-prompt-utils';

import type { ResolvedAuthSession } from '../../core/auth/auth-types';
import type { OutputFormatter } from '../../output';

interface IAuthSessionManager {
  getStatus(): Promise<ResolvedAuthSession>;
  clearSession(): Promise<void>;
}

export const LOGOUT_CONFIRM_PROMPT =
  'Confirm logout of current wallet? (y/N): ';

export async function executeAuthLogoutCommand(params: {
  output: OutputFormatter;
  skipConfirmation?: boolean;
  authManager?: IAuthSessionManager;
  confirm?: (prompt: string) => Promise<boolean>;
  isTTY?: boolean;
}): Promise<void> {
  const {
    output,
    skipConfirmation = false,
    authManager = new AuthManager(),
    confirm = readConfirmation,
    isTTY = process.stdin.isTTY,
  } = params;

  try {
    const currentSession = await authManager.getStatus();

    if (currentSession.authStatus !== 'authenticated') {
      output.success(presentAuthLogoutResult('already_logged_out'));
      return;
    }

    if (!skipConfirmation) {
      if (output.getMode() !== 'human' || !isTTY) {
        throw new AppError(
          ERROR_CODES.USER_CANCELLED.code,
          'Logout requires confirmation. Pass --yes to continue.',
          'Run with --yes to skip confirmation',
        );
      }

      const confirmed = await confirm(LOGOUT_CONFIRM_PROMPT);
      if (!confirmed) {
        output.success(presentAuthLogoutResult('cancelled', currentSession));
        return;
      }
    }

    await authManager.clearSession();

    output.success(presentAuthLogoutResult('logged_out'));
  } catch (error) {
    const appError = AppError.from(error);
    output.error(appError.toErrorDetail());
    process.exitCode = appError.exitCode;
  }
}
