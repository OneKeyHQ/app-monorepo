import { ERROR_CODES } from '../../../errors';
import { BotWalletAuthManager } from '../_internal/bot-wallet-auth-manager';

describe('BotWalletAuthManager', () => {
  it('maps vault storage access errors to SEC_STORAGE_ACCESS_DENIED', async () => {
    const deniedError = Object.assign(
      new Error(
        "EPERM: operation not permitted, mkdir '/Users/test/.onekey-cli'",
      ),
      { code: 'EPERM' },
    );
    const manager = new BotWalletAuthManager({
      keychainStorage: {
        getBackendType: () => 'macos-keychain',
      },
      executeStatusPipeline: jest.fn(async () => {
        throw deniedError;
      }),
    });

    await expect(manager.getStatus()).rejects.toMatchObject({
      code: ERROR_CODES.SEC_STORAGE_ACCESS_DENIED.code,
      message: deniedError.message,
      suggestion: 'Check the CLI vault storage permissions and retry.',
    });
  });
});
