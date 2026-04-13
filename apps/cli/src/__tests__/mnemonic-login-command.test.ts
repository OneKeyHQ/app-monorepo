import { executeMnemonicLoginCommand } from '../commands/auth/mnemonic-login-command';

import type { OutputFormatter } from '../output';

describe('executeMnemonicLoginCommand', () => {
  let output: Pick<OutputFormatter, 'error' | 'success'>;

  beforeEach(() => {
    output = {
      error: jest.fn(),
      success: jest.fn(),
    };
    process.exitCode = 0;
  });

  it('requires an explicit --mnemonic selector when configured', async () => {
    await executeMnemonicLoginCommand({
      output: output as OutputFormatter,
      requiresMnemonicFlag: true,
      mnemonicFlag: false,
      missingMethodMessage: 'Login method required. Use --mnemonic.',
      missingMethodSuggestion: 'Run: onekey auth login --mnemonic',
    });

    expect(output.error).toHaveBeenCalledWith({
      code: 'PARAM_MISSING_REQUIRED',
      message: 'Login method required. Use --mnemonic.',
      suggestion: 'Run: onekey auth login --mnemonic',
    });
    expect(process.exitCode).toBe(2);
  });

  it('delegates mnemonic login to the shared auth manager and formats success', async () => {
    const authManager = {
      loginWithMnemonic: jest.fn(async () => ({ address: '0xabc' })),
    };
    const readInput = jest.fn(async () => 'raw mnemonic');

    await executeMnemonicLoginCommand({
      output: output as OutputFormatter,
      requiresMnemonicFlag: true,
      mnemonicFlag: true,
      missingMethodMessage: 'Login method required. Use --mnemonic.',
      missingMethodSuggestion: 'Run: onekey auth login --mnemonic',
      authManager,
      readInput,
    });

    expect(readInput).toHaveBeenCalledTimes(1);
    expect(authManager.loginWithMnemonic).toHaveBeenCalledWith('raw mnemonic');
    expect(output.success).toHaveBeenCalledWith({ address: '0xabc' });
  });
});
