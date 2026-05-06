import {
  LOGOUT_CONFIRM_PROMPT,
  executeAuthLogoutCommand,
} from '../commands/auth/auth-logout-command';
import { ERROR_CODES } from '../errors';

import type { ResolvedAuthSession } from '../core/auth/auth-types';
import type { OutputFormatter } from '../output';

const AUTHENTICATED_SESSION = {
  authStatus: 'authenticated' as const,
  hasSecrets: true,
  storageBackend: 'macos-keychain' as const,
  loginMethod: 'app_transfer' as const,
  walletKind: 'hd' as const,
  sourceLabel: 'Bot Wallet (abcd1234)',
  displayAddress: '0x1234567890abcdef1234567890abcdef12345678',
  importedAt: '2026-04-06T06:20:00.000Z',
};

describe('executeAuthLogoutCommand', () => {
  let output: Pick<OutputFormatter, 'error' | 'success' | 'getMode'>;

  beforeEach(() => {
    output = {
      error: jest.fn(),
      success: jest.fn(),
      getMode: jest.fn(() => 'human'),
    };
    process.exitCode = 0;
  });

  it('returns already_logged_out when no active wallet exists', async () => {
    const unauthenticatedSession: ResolvedAuthSession = {
      authStatus: 'unauthenticated',
      hasSecrets: false,
      storageBackend: 'macos-keychain',
    };
    const authManager = {
      getStatus: jest.fn(async () => unauthenticatedSession),
      clearSession: jest.fn(async () => {}),
    };

    await executeAuthLogoutCommand({
      output: output as OutputFormatter,
      authManager,
      isTTY: true,
    });

    expect(output.success).toHaveBeenCalledWith({
      status: 'already_logged_out',
      authStatus: 'unauthenticated',
      changed: false,
      sourceLabel: null,
      displayAddress: null,
    });
    expect(authManager.clearSession).not.toHaveBeenCalled();
  });

  it('requires --yes outside human tty mode when a wallet is active', async () => {
    const authManager = {
      getStatus: jest.fn(async () => AUTHENTICATED_SESSION),
      clearSession: jest.fn(async () => {}),
    };
    output.getMode = jest.fn(() => 'agent');

    await executeAuthLogoutCommand({
      output: output as OutputFormatter,
      authManager,
      isTTY: false,
    });

    expect(output.error).toHaveBeenCalledWith({
      code: ERROR_CODES.USER_CANCELLED.code,
      message: 'Logout requires confirmation. Pass --yes to continue.',
      suggestion: 'Run with --yes to skip confirmation',
    });
    expect(authManager.clearSession).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(ERROR_CODES.USER_CANCELLED.exitCode);
  });

  it('keeps the current session when the user cancels confirmation', async () => {
    const authManager = {
      getStatus: jest.fn(async () => AUTHENTICATED_SESSION),
      clearSession: jest.fn(async () => {}),
    };
    const confirm = jest.fn(async () => false);

    await executeAuthLogoutCommand({
      output: output as OutputFormatter,
      authManager,
      confirm,
      isTTY: true,
    });

    expect(confirm).toHaveBeenCalledWith(LOGOUT_CONFIRM_PROMPT);
    expect(output.success).toHaveBeenCalledWith({
      status: 'cancelled',
      authStatus: 'authenticated',
      changed: false,
      sourceLabel: 'Bot Wallet (abcd1234)',
      displayAddress: '0x123456...345678',
    });
    expect(authManager.clearSession).not.toHaveBeenCalled();
  });

  it('clears the session after confirmation', async () => {
    const authManager = {
      getStatus: jest.fn(async () => AUTHENTICATED_SESSION),
      clearSession: jest.fn(async () => {}),
    };
    const confirm = jest.fn(async () => true);

    await executeAuthLogoutCommand({
      output: output as OutputFormatter,
      authManager,
      confirm,
      isTTY: true,
    });

    expect(confirm).toHaveBeenCalledWith(LOGOUT_CONFIRM_PROMPT);
    expect(authManager.clearSession).toHaveBeenCalledTimes(1);
    expect(output.success).toHaveBeenCalledWith({
      status: 'logged_out',
      authStatus: 'unauthenticated',
      changed: true,
      sourceLabel: null,
      displayAddress: null,
    });
  });
});
