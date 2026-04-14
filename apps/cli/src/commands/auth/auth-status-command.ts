import { AuthManager } from '../../core/auth/auth-manager';
import { AppError } from '../../errors';
import { presentAuthStatus } from '../../output/auth-presenters';

import type { ResolvedAuthSession } from '../../core/auth/auth-types';
import type { OutputFormatter } from '../../output';

interface IAuthStatusReader {
  getStatus(): Promise<ResolvedAuthSession>;
}

export async function executeAuthStatusCommand(params: {
  output: OutputFormatter;
  authManager?: IAuthStatusReader;
}): Promise<void> {
  const { output, authManager = new AuthManager() } = params;

  try {
    const status = await authManager.getStatus();
    output.success(presentAuthStatus(status));
  } catch (error) {
    const appError = AppError.from(error);
    output.error(appError.toErrorDetail());
    process.exitCode = appError.exitCode;
  }
}
