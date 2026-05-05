import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { executeAuthStatusCommand } from '../commands/auth/auth-status-command';
import { ERROR_CODES } from '../errors';

import type { ResolvedAuthSession } from '../core/auth/auth-types';
import type { OutputFormatter } from '../output';

describe('executeAuthStatusCommand', () => {
  let output: Pick<OutputFormatter, 'error' | 'success'>;

  beforeEach(() => {
    output = {
      error: jest.fn(),
      success: jest.fn(),
    };
    process.exitCode = 0;
  });

  it('formats authenticated auth status as structured output', async () => {
    const authenticatedSession: ResolvedAuthSession = {
      authStatus: 'authenticated',
      hasSecrets: true,
      storageBackend: 'macos-keychain',
      loginMethod: 'app_transfer',
      walletKind: 'hd',
      sourceLabel: 'Bot Wallet (abcd1234)',
      displayAddress: '0x1234567890abcdef1234567890abcdef12345678',
      importedAt: '2026-04-06T06:10:00.000Z',
    };
    const authManager = {
      getStatus: jest.fn(async () => authenticatedSession),
    };

    await executeAuthStatusCommand({
      output: output as OutputFormatter,
      authManager,
    });

    expect(output.success).toHaveBeenCalledWith({
      authStatus: 'authenticated',
      hasSecrets: true,
      storageBackend: 'macos-keychain',
      loginMethod: 'app_transfer',
      walletKind: 'hd',
      sourceLabel: 'Bot Wallet (abcd1234)',
      displayAddress: '0x1234567890abcdef1234567890abcdef12345678',
      importedAt: '2026-04-06T06:10:00.000Z',
      device: null,
      passphraseMode: null,
    });
  });

  it('formats unauthenticated auth status with null metadata fields', async () => {
    const unauthenticatedSession: ResolvedAuthSession = {
      authStatus: 'unauthenticated',
      hasSecrets: false,
      storageBackend: 'linux-secret-service',
    };
    const authManager = {
      getStatus: jest.fn(async () => unauthenticatedSession),
    };

    await executeAuthStatusCommand({
      output: output as OutputFormatter,
      authManager,
    });

    expect(output.success).toHaveBeenCalledWith({
      authStatus: 'unauthenticated',
      hasSecrets: false,
      storageBackend: 'linux-secret-service',
      loginMethod: null,
      walletKind: null,
      sourceLabel: null,
      displayAddress: null,
      importedAt: null,
      device: null,
      passphraseMode: null,
    });
  });

  it('formats status lookup failures as app errors', async () => {
    const authManager = {
      getStatus: jest.fn(async () => {
        throw new OneKeyLocalError('storage locked');
      }),
    };

    await executeAuthStatusCommand({
      output: output as OutputFormatter,
      authManager,
    });

    expect(output.error).toHaveBeenCalledWith({
      code: ERROR_CODES.BIZ_UNKNOWN.code,
      message: 'storage locked',
      suggestion: 'Check the error details and retry',
    });
    expect(process.exitCode).toBe(ERROR_CODES.BIZ_UNKNOWN.exitCode);
  });
});
