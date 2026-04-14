import {
  EPrimeTransferDataType,
  EPrimeTransferServerType,
} from '@onekeyhq/shared/types/prime/primeTransferTypes';

import { executeAuthLoginCommand } from '../commands/auth/auth-login-command';
import { AppError, ERROR_CODES } from '../errors';

import type {
  AppTransferLoginResult,
  ResolvedAuthSession,
} from '../core/auth/auth-types';
import type { OutputFormatter } from '../output';

function makeUnauthenticatedStatus(): ResolvedAuthSession {
  return {
    authStatus: 'unauthenticated',
    hasSecrets: false,
    storageBackend: 'macos-keychain',
  };
}

function makeAuthenticatedStatus(): ResolvedAuthSession {
  return {
    authStatus: 'authenticated',
    hasSecrets: true,
    storageBackend: 'macos-keychain',
    loginMethod: 'mnemonic',
    walletKind: 'hd',
    displayAddress: '0x1234567890abcdef1234567890abcdef12345678',
    importedAt: '2026-04-06T07:00:00.000Z',
    sourceLabel: 'Mnemonic Import',
  };
}

function makePairingResult(): AppTransferLoginResult {
  return {
    status: 'pairing',
    loginMethod: 'app_transfer',
    pairingCode: 'ABCDEFGH123-ABCDE-FGHIJ-KLMNP-QRSTU-VWXYZ-12345-6789A',
    createdAt: '2026-04-06T07:00:00.000Z',
    timeoutMs: 120_000,
    expiresAt: '2026-04-06T07:02:00.000Z',
    pairingPayload: {
      roomId: 'ABCDEFGH123',
      transferType: EPrimeTransferDataType.keylessWallet,
      serverType: EPrimeTransferServerType.OFFICIAL,
      websocketEndpoint: 'wss://transfer.onekeytest.com',
      uri: 'onekey-wallet://cross-device-transfer/?code=ABCDEFGH123-ABCDE-FGHIJ-KLMNP-QRSTU-VWXYZ-12345-6789A',
      verifyString: 'OneKeyPrimeTransfer',
    },
  };
}

describe('executeAuthLoginCommand', () => {
  let output: Pick<OutputFormatter, 'error' | 'success'>;
  let exit: jest.Mock<void, [number]>;

  beforeEach(() => {
    output = {
      error: jest.fn(),
      success: jest.fn(),
    };
    exit = jest.fn();
    process.exitCode = 0;
  });

  afterEach(() => {
    process.exitCode = 0;
  });

  it('routes a human tty login session into the app transfer branch when selected', async () => {
    const pairingResult = makePairingResult();
    const runAppTransferPairingDisplay = jest.fn(async () => undefined);
    const authManager = {
      getStatus: jest
        .fn()
        .mockResolvedValueOnce(makeUnauthenticatedStatus())
        .mockResolvedValueOnce({
          authStatus: 'authenticated',
          hasSecrets: true,
          storageBackend: 'macos-keychain',
          loginMethod: 'app_transfer',
          walletKind: 'hd',
          displayAddress: '0xabc',
          importedAt: '2026-04-06T07:00:00.000Z',
          sourceLabel: 'Bot Wallet (deadbeef)',
        } satisfies ResolvedAuthSession),
      loginWithMnemonic: jest.fn(async () => ({ address: '0xabc' })),
      startAppTransferLogin: jest.fn(async () => pairingResult),
    };
    const selectMethod = jest.fn(async () => 'app_transfer' as const);

    await executeAuthLoginCommand({
      output: output as OutputFormatter,
      mnemonicFlag: false,
      isHumanMode: true,
      isTTY: true,
      env: 'test',
      authManager,
      selectMethod,
      runAppTransferPairingDisplay,
      exit,
    });

    expect(selectMethod).toHaveBeenCalledTimes(1);
    expect(authManager.startAppTransferLogin).toHaveBeenCalledWith({
      endpointEnv: 'test',
    });
    expect(runAppTransferPairingDisplay).toHaveBeenCalledWith(pairingResult);
    expect(output.success).toHaveBeenCalledWith({
      auth_status: 'authenticated',
      login_method: 'app_transfer',
      source_label: 'Bot Wallet (deadbeef)',
      display_address: '0xabc',
      storage_backend: 'macos-keychain',
    });
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('routes a human tty login session into mnemonic import when selected', async () => {
    const authManager = {
      getStatus: jest.fn(async () => makeUnauthenticatedStatus()),
      loginWithMnemonic: jest.fn(async () => ({ address: '0xabc' })),
      startAppTransferLogin: jest.fn(async () => makePairingResult()),
    };
    const selectMethod = jest.fn(async () => 'mnemonic' as const);
    const readInput = jest.fn(async () => 'raw mnemonic');

    await executeAuthLoginCommand({
      output: output as OutputFormatter,
      mnemonicFlag: false,
      isHumanMode: true,
      isTTY: true,
      authManager,
      selectMethod,
      readInput,
      exit,
    });

    expect(readInput).toHaveBeenCalledTimes(1);
    expect(authManager.loginWithMnemonic).toHaveBeenCalledWith('raw mnemonic');
    expect(authManager.startAppTransferLogin).not.toHaveBeenCalled();
    expect(output.success).toHaveBeenCalledWith({ address: '0xabc' });
    expect(exit).not.toHaveBeenCalled();
  });

  it('waits for app transfer completion and returns structured auth output in agent mode', async () => {
    const pairingResult = makePairingResult();
    const waitForHeadlessAppTransferCompletion = jest.fn(async () => undefined);
    const authManager = {
      getStatus: jest
        .fn()
        .mockResolvedValueOnce(makeUnauthenticatedStatus())
        .mockResolvedValueOnce({
          authStatus: 'authenticated',
          hasSecrets: true,
          storageBackend: 'macos-keychain',
          loginMethod: 'app_transfer',
          walletKind: 'hd',
          displayAddress: '0xdef',
          importedAt: '2026-04-06T07:00:00.000Z',
          sourceLabel: 'Bot Wallet (deadbeef)',
        } satisfies ResolvedAuthSession),
      loginWithMnemonic: jest.fn(async () => ({ address: '0xabc' })),
      startAppTransferLogin: jest.fn(async () => pairingResult),
    };

    await executeAuthLoginCommand({
      output: output as OutputFormatter,
      appTransferFlag: true,
      isHumanMode: false,
      isTTY: true,
      env: 'test',
      authManager,
      waitForHeadlessAppTransferCompletion,
      exit,
    });

    expect(authManager.startAppTransferLogin).toHaveBeenCalledWith({
      endpointEnv: 'test',
    });
    expect(waitForHeadlessAppTransferCompletion).toHaveBeenCalledWith(
      pairingResult,
    );
    expect(output.success).toHaveBeenCalledWith({
      auth_status: 'authenticated',
      login_method: 'app_transfer',
      source_label: 'Bot Wallet (deadbeef)',
      display_address: '0xdef',
      storage_backend: 'macos-keychain',
    });
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('rejects non-tty app transfer before the pairing session starts', async () => {
    const authManager = {
      getStatus: jest.fn(async () => makeUnauthenticatedStatus()),
      loginWithMnemonic: jest.fn(async () => ({ address: '0xabc' })),
      clearSession: jest.fn(async () => undefined),
      startAppTransferLogin: jest.fn(async () => makePairingResult()),
    };
    const waitForHeadlessAppTransferCompletion = jest.fn(async () => undefined);

    await executeAuthLoginCommand({
      output: output as OutputFormatter,
      appTransferFlag: true,
      isHumanMode: false,
      isTTY: false,
      authManager,
      waitForHeadlessAppTransferCompletion,
      exit,
    });

    expect(authManager.startAppTransferLogin).not.toHaveBeenCalled();
    expect(waitForHeadlessAppTransferCompletion).not.toHaveBeenCalled();
    expect(output.error).toHaveBeenCalledWith({
      code: 'PARAM_REQUIRES_TTY',
      message: 'App Transfer login requires an interactive TTY terminal.',
      suggestion:
        'Run this command in an interactive terminal, or use --mnemonic until a dedicated non-interactive App Transfer mode is available.',
    });
    expect(process.exitCode).toBe(2);
    expect(exit).not.toHaveBeenCalled();
  });

  it('keeps non-tty callers on the explicit method path', async () => {
    const authManager = {
      getStatus: jest.fn(async () => makeUnauthenticatedStatus()),
      loginWithMnemonic: jest.fn(async () => ({ address: '0xabc' })),
      startAppTransferLogin: jest.fn(async () => makePairingResult()),
    };

    await executeAuthLoginCommand({
      output: output as OutputFormatter,
      mnemonicFlag: false,
      isHumanMode: false,
      isTTY: false,
      authManager,
      exit,
    });

    expect(output.error).toHaveBeenCalledWith({
      code: 'PARAM_MISSING_REQUIRED',
      message: 'Login method required. Use --mnemonic or --app-transfer.',
      suggestion:
        'Run: onekey auth login --mnemonic or onekey auth login --app-transfer',
    });
    expect(process.exitCode).toBe(2);
    expect(authManager.getStatus).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });

  it('rejects conflicting login method flags', async () => {
    const authManager = {
      getStatus: jest.fn(async () => makeUnauthenticatedStatus()),
      loginWithMnemonic: jest.fn(async () => ({ address: '0xabc' })),
      startAppTransferLogin: jest.fn(async () => makePairingResult()),
    };

    await executeAuthLoginCommand({
      output: output as OutputFormatter,
      mnemonicFlag: true,
      appTransferFlag: true,
      isHumanMode: false,
      isTTY: false,
      authManager,
      exit,
    });

    expect(output.error).toHaveBeenCalledWith({
      code: 'PARAM_INVALID_CONFIG',
      message: 'Choose only one login method flag',
      suggestion: 'Use either --mnemonic or --app-transfer',
    });
    expect(authManager.getStatus).not.toHaveBeenCalled();
    expect(authManager.startAppTransferLogin).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(2);
    expect(exit).not.toHaveBeenCalled();
  });

  it('blocks the menu flow when an authenticated wallet already exists', async () => {
    const authManager = {
      getStatus: jest.fn(async () => makeAuthenticatedStatus()),
      loginWithMnemonic: jest.fn(async () => ({ address: '0xabc' })),
      startAppTransferLogin: jest.fn(async () => makePairingResult()),
    };
    const selectMethod = jest.fn(async () => 'app_transfer' as const);

    await executeAuthLoginCommand({
      output: output as OutputFormatter,
      mnemonicFlag: false,
      isHumanMode: true,
      isTTY: true,
      authManager,
      selectMethod,
      exit,
    });

    expect(selectMethod).not.toHaveBeenCalled();
    expect(authManager.startAppTransferLogin).not.toHaveBeenCalled();
    expect(output.error).toHaveBeenCalledWith({
      code: 'AUTH_WALLET_EXISTS',
      message:
        'Wallet already exists. Log out before importing another wallet.',
      suggestion: 'Run: onekey auth logout',
    });
    expect(process.exitCode).toBe(4);
    expect(exit).not.toHaveBeenCalled();
  });

  it('returns to the login menu after interactive app transfer cancellation', async () => {
    const pairingResult = makePairingResult();
    const runAppTransferPairingDisplay = jest
      .fn()
      .mockRejectedValueOnce(
        new AppError(
          ERROR_CODES.AUTH_TRANSFER_CANCELLED.code,
          'Transfer cancelled.',
          'Retry the App Transfer login flow',
        ),
      );
    const authManager = {
      getStatus: jest.fn(async () => makeUnauthenticatedStatus()),
      loginWithMnemonic: jest.fn(async () => ({ address: '0xabc' })),
      startAppTransferLogin: jest.fn(async () => pairingResult),
    };
    const selectMethod = jest
      .fn()
      .mockResolvedValueOnce('app_transfer' as const)
      .mockResolvedValueOnce('mnemonic' as const);
    const readInput = jest.fn(async () => 'raw mnemonic');

    await executeAuthLoginCommand({
      output: output as OutputFormatter,
      isHumanMode: true,
      isTTY: true,
      authManager,
      selectMethod,
      readInput,
      runAppTransferPairingDisplay,
      exit,
    });

    expect(selectMethod).toHaveBeenCalledTimes(2);
    expect(runAppTransferPairingDisplay).toHaveBeenCalledTimes(1);
    expect(authManager.startAppTransferLogin).toHaveBeenCalledTimes(1);
    expect(authManager.loginWithMnemonic).toHaveBeenCalledWith('raw mnemonic');
    expect(output.success).toHaveBeenCalledWith({ address: '0xabc' });
    expect(output.error).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });

  it('reports structured retry guidance when headless app transfer times out', async () => {
    const pairingResult = makePairingResult();
    const waitForHeadlessAppTransferCompletion = jest.fn(async () => {
      throw new AppError(
        ERROR_CODES.AUTH_TRANSFER_TIMEOUT.code,
        'Transfer timed out.',
        'Retry the App Transfer login flow',
      );
    });
    const authManager = {
      getStatus: jest.fn(async () => makeUnauthenticatedStatus()),
      loginWithMnemonic: jest.fn(async () => ({ address: '0xabc' })),
      startAppTransferLogin: jest.fn(async () => pairingResult),
    };

    await executeAuthLoginCommand({
      output: output as OutputFormatter,
      appTransferFlag: true,
      isHumanMode: false,
      isTTY: true,
      authManager,
      waitForHeadlessAppTransferCompletion,
      exit,
    });

    expect(output.error).toHaveBeenCalledWith({
      code: 'AUTH_TRANSFER_TIMEOUT',
      message: 'Transfer timed out.',
      suggestion: 'Retry the App Transfer login flow',
      details: {
        status: 'timeout',
        auth_status: 'unauthenticated',
        login_method: 'app_transfer',
        source_label: null,
        display_address: null,
        storage_backend: null,
        next_action: 'retry_app_transfer',
      },
    });
    expect(process.exitCode).toBe(4);
    expect(exit).toHaveBeenCalledWith(
      ERROR_CODES.AUTH_TRANSFER_TIMEOUT.exitCode,
    );
  });

  it('reports structured cancellation guidance outside the interactive menu flow', async () => {
    const pairingResult = makePairingResult();
    const waitForHeadlessAppTransferCompletion = jest.fn(async () => {
      throw new AppError(
        ERROR_CODES.AUTH_TRANSFER_CANCELLED.code,
        'Transfer cancelled.',
        'Retry the App Transfer login flow',
      );
    });
    const authManager = {
      getStatus: jest.fn(async () => makeUnauthenticatedStatus()),
      loginWithMnemonic: jest.fn(async () => ({ address: '0xabc' })),
      startAppTransferLogin: jest.fn(async () => pairingResult),
    };

    await executeAuthLoginCommand({
      output: output as OutputFormatter,
      appTransferFlag: true,
      isHumanMode: false,
      isTTY: true,
      authManager,
      waitForHeadlessAppTransferCompletion,
      exit,
    });

    expect(output.error).toHaveBeenCalledWith({
      code: 'AUTH_TRANSFER_CANCELLED',
      message: 'Transfer cancelled.',
      suggestion: 'Retry the App Transfer login flow',
      details: {
        status: 'cancelled',
        auth_status: 'unauthenticated',
        login_method: 'app_transfer',
        source_label: null,
        display_address: null,
        storage_backend: null,
        next_action: 'retry_app_transfer',
      },
    });
    expect(process.exitCode).toBe(4);
    expect(exit).toHaveBeenCalledWith(
      ERROR_CODES.AUTH_TRANSFER_CANCELLED.exitCode,
    );
  });
});
