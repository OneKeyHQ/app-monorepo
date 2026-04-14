import { AuthManager } from '../../core/auth/auth-manager';
import { AppError, ERROR_CODES } from '../../errors';

import { readMnemonicInput } from './auth-prompt-utils';

import type { MnemonicLoginResult } from '../../core/auth/auth-types';
import type { OutputFormatter } from '../../output';

interface IMnemonicLoginHandler {
  loginWithMnemonic(rawMnemonic: string): Promise<MnemonicLoginResult>;
}

interface IExecuteMnemonicLoginCommandParams {
  output: OutputFormatter;
  requiresMnemonicFlag: boolean;
  mnemonicFlag?: boolean;
  missingMethodMessage: string;
  missingMethodSuggestion: string;
  authManager?: IMnemonicLoginHandler;
  readInput?: () => Promise<string>;
  beforeFinalize?: () => void;
}

export async function executeMnemonicLoginCommand({
  output,
  requiresMnemonicFlag,
  mnemonicFlag,
  missingMethodMessage,
  missingMethodSuggestion,
  authManager = new AuthManager(),
  readInput = readMnemonicInput,
  beforeFinalize,
}: IExecuteMnemonicLoginCommandParams): Promise<void> {
  try {
    if (requiresMnemonicFlag && !mnemonicFlag) {
      beforeFinalize?.();
      output.error({
        code: ERROR_CODES.PARAM_MISSING_REQUIRED.code,
        message: missingMethodMessage,
        suggestion: missingMethodSuggestion,
      });
      process.exitCode = ERROR_CODES.PARAM_MISSING_REQUIRED.exitCode;
      return;
    }

    const rawMnemonic = await readInput();
    const result = await authManager.loginWithMnemonic(rawMnemonic);

    beforeFinalize?.();
    output.success({ address: result.address });
  } catch (error) {
    beforeFinalize?.();
    const appError = AppError.from(error);
    output.error(appError.toErrorDetail());
    process.exitCode = appError.exitCode;
  }
}
