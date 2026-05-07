import {
  EPrimeTransferDataType,
  EPrimeTransferServerType,
} from '@onekeyhq/shared/types/prime/primeTransferTypes';

import { executeAuthLoginCommand } from '../commands/auth/auth-login-command';
import {
  registerActiveAuthFlowCleanup,
  resetActiveAuthFlowCleanupForTests,
  runActiveAuthFlowCleanup,
} from '../core/auth/auth-flow-interruption';
import {
  getActiveTransferPairingRuntime,
  replaceActiveTransferPairingRuntime,
  startTransferPairingRuntimeTimeout,
} from '../core/prime-transfer/pairing-session-runtime';
import { AppError, ERROR_CODES } from '../errors';

import type {
  AppTransferLoginResult,
  ResolvedAuthSession,
} from '../core/auth/auth-types';
import type {
  ITransferPairingRuntime,
  ITransferStateSnapshot,
} from '../core/prime-transfer/transfer-types';
import type { OutputFormatter } from '../output';

jest.mock('../core/prime-transfer/pairing-session-runtime', () => ({
  __esModule: true,
  getActiveTransferPairingRuntime: jest.fn(() => null),
  getTransferPairingRuntimeError: jest.fn(() => null),
  replaceActiveTransferPairingRuntime: jest.fn(async () => undefined),
  startTransferPairingRuntimeTimeout: jest.fn(() => null),
}));

const mockedGetActiveRuntime =
  getActiveTransferPairingRuntime as jest.MockedFunction<
    typeof getActiveTransferPairingRuntime
  >;
const mockedReplaceActiveRuntime =
  replaceActiveTransferPairingRuntime as jest.MockedFunction<
    typeof replaceActiveTransferPairingRuntime
  >;
const mockedStartRuntimeTimeout =
  startTransferPairingRuntimeTimeout as jest.MockedFunction<
    typeof startTransferPairingRuntimeTimeout
  >;

function makeCompletedRuntime(pairingCode: string): ITransferPairingRuntime {
  const terminalState: ITransferStateSnapshot = {
    event: 'transfer_completed',
    status: 'completed',
    message: 'Completed',
    isTerminal: true,
    updatedAt: '2026-04-06T07:01:00.000Z',
  };
  return {
    roomId: 'ABCDEFGH123',
    userId: 'user-1',
    pairingCode,
    getVerificationCode: () => null,
    setVerificationCode: () => undefined,
    getState: () => terminalState,
    subscribe: () => () => undefined,
    transition: () => terminalState,
    waitForState: async () => terminalState,
    dispose: async () => undefined,
  };
}

function makeUnauthenticatedStatus(): ResolvedAuthSession {
  return {
    authStatus: 'unauthenticated',
    hasSecrets: false,
    storageBackend: 'macos-keychain',
  };
}

function makeAuthenticatedStatus(
  overrides: Partial<ResolvedAuthSession> = {},
): ResolvedAuthSession {
  return {
    authStatus: 'authenticated',
    hasSecrets: true,
    storageBackend: 'macos-keychain',
    loginMethod: 'app_transfer',
    walletKind: 'hd',
    displayAddress: '0x1234567890abcdef1234567890abcdef12345678',
    importedAt: '2026-04-06T07:00:00.000Z',
    sourceLabel: 'Bot Wallet (deadbeef)',
    ...overrides,
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

function makeOutputMock(): Pick<
  OutputFormatter,
  'error' | 'success' | 'warn' | 'getMode'
> {
  return {
    error: jest.fn(),
    success: jest.fn(),
    warn: jest.fn(),
    getMode: jest.fn(() => 'agent'),
  };
}

describe('executeAuthLoginCommand', () => {
  let output: Pick<OutputFormatter, 'error' | 'success' | 'warn' | 'getMode'>;
  let exit: jest.Mock<void, [number]>;

  beforeEach(() => {
    output = makeOutputMock();
    exit = jest.fn();
    process.exitCode = 0;
    resetActiveAuthFlowCleanupForTests();
    mockedGetActiveRuntime.mockReset().mockReturnValue(null);
    mockedReplaceActiveRuntime.mockReset().mockResolvedValue(undefined);
    mockedStartRuntimeTimeout.mockReset().mockReturnValue(null);
  });

  afterEach(() => {
    process.exitCode = 0;
    resetActiveAuthFlowCleanupForTests();
  });

  it('emits PARAM_MISSING_REQUIRED when no login method flag is provided', async () => {
    const authManager = {
      getStatus: jest.fn(async () => makeUnauthenticatedStatus()),
      startAppTransferLogin: jest.fn(async () => makePairingResult()),
    };

    await executeAuthLoginCommand({
      output: output as OutputFormatter,
      isHumanMode: false,
      isTTY: false,
      authManager,
      exit,
    });

    expect(output.error).toHaveBeenCalledWith({
      code: ERROR_CODES.PARAM_MISSING_REQUIRED.code,
      message: 'Login method required. Use --app-transfer or --hardware.',
      suggestion: 'Run: onekey auth login --app-transfer | --hardware',
    });
    expect(authManager.getStatus).not.toHaveBeenCalled();
    expect(authManager.startAppTransferLogin).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(ERROR_CODES.PARAM_MISSING_REQUIRED.exitCode);
    expect(exit).not.toHaveBeenCalled();
  });

  it('blocks --payload login when an authenticated wallet already exists', async () => {
    const authManager = {
      getStatus: jest.fn(async () => makeAuthenticatedStatus()),
      startAppTransferLogin: jest.fn(async () => makePairingResult()),
    };
    const routeAuthSession = jest.fn(async () => ({
      ok: true as const,
      data: { keyId: 'A'.repeat(43) },
    }));

    await executeAuthLoginCommand({
      output: output as OutputFormatter,
      payload: JSON.stringify({
        kind: 'cli-bot-wallet',
        payload: { keyId: 'A'.repeat(43) },
      }),
      authManager,
      routeAuthSession,
      exit,
    });

    expect(authManager.getStatus).toHaveBeenCalledTimes(1);
    expect(routeAuthSession).not.toHaveBeenCalled();
    expect(output.error).toHaveBeenCalledWith({
      code: ERROR_CODES.AUTH_WALLET_EXISTS.code,
      message:
        'Wallet already exists. Log out before importing another wallet.',
      suggestion: 'Run: onekey auth logout',
    });
    expect(process.exitCode).toBe(ERROR_CODES.AUTH_WALLET_EXISTS.exitCode);
    expect(exit).not.toHaveBeenCalled();
  });

  it('rejects combining --app-transfer and --hardware', async () => {
    const authManager = {
      getStatus: jest.fn(async () => makeUnauthenticatedStatus()),
      startAppTransferLogin: jest.fn(async () => makePairingResult()),
      persistHardwareSession: jest.fn(async () => undefined),
    };
    const runHardwareLogin = jest.fn(async () => undefined);

    await executeAuthLoginCommand({
      output: output as OutputFormatter,
      appTransferFlag: true,
      hardwareFlag: true,
      isHumanMode: false,
      isTTY: false,
      authManager,
      runHardwareLogin,
      exit,
    });

    expect(output.error).toHaveBeenCalledWith({
      code: ERROR_CODES.PARAM_MISSING_REQUIRED.code,
      message: '--app-transfer and --hardware are mutually exclusive.',
      suggestion: 'Pass only one of the two flags.',
    });
    expect(runHardwareLogin).not.toHaveBeenCalled();
    expect(authManager.startAppTransferLogin).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(ERROR_CODES.PARAM_MISSING_REQUIRED.exitCode);
    expect(exit).not.toHaveBeenCalled();
  });

  it('routes --hardware to the hardware login flow', async () => {
    const authManager = {
      getStatus: jest.fn(async () => makeUnauthenticatedStatus()),
      startAppTransferLogin: jest.fn(async () => makePairingResult()),
      persistHardwareSession: jest.fn(async () => undefined),
    };
    type IHardwareLoginDeps = {
      output: unknown;
      isTTY: boolean;
      isHumanMode: boolean;
      getStatus: () => Promise<ResolvedAuthSession>;
      persistSession: (...args: never[]) => Promise<void>;
    };
    const runHardwareLogin: jest.Mock<
      Promise<void>,
      [IHardwareLoginDeps]
    > = jest.fn(async (_deps: IHardwareLoginDeps) => undefined);

    await executeAuthLoginCommand({
      output: output as OutputFormatter,
      hardwareFlag: true,
      isHumanMode: true,
      isTTY: true,
      authManager,
      runHardwareLogin,
      exit,
    });

    expect(runHardwareLogin).toHaveBeenCalledTimes(1);
    const deps = runHardwareLogin.mock.calls[0][0];
    expect(deps.isTTY).toBe(true);
    expect(deps.isHumanMode).toBe(true);
    expect(typeof deps.persistSession).toBe('function');
    expect(authManager.startAppTransferLogin).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });

  it('surfaces hardware login errors through the output formatter', async () => {
    const authManager = {
      getStatus: jest.fn(async () => makeUnauthenticatedStatus()),
      startAppTransferLogin: jest.fn(async () => makePairingResult()),
      persistHardwareSession: jest.fn(async () => undefined),
    };
    const runHardwareLogin = jest.fn(async () => {
      throw new AppError(
        ERROR_CODES.AUTH_WALLET_EXISTS.code,
        'Wallet already exists. Log out before importing another wallet.',
        'Run: onekey auth logout',
      );
    });

    await executeAuthLoginCommand({
      output: output as OutputFormatter,
      hardwareFlag: true,
      isHumanMode: true,
      isTTY: true,
      authManager,
      runHardwareLogin,
      exit,
    });

    expect(output.error).toHaveBeenCalledWith(
      expect.objectContaining({
        code: ERROR_CODES.AUTH_WALLET_EXISTS.code,
      }),
    );
    expect(process.exitCode).toBe(ERROR_CODES.AUTH_WALLET_EXISTS.exitCode);
    expect(exit).not.toHaveBeenCalled();
  });

  it('runs the interactive pairing display in human TTY mode and emits the structured login result', async () => {
    const pairingResult = makePairingResult();
    const runAppTransferPairingDisplay = jest.fn(async () => undefined);
    const authManager = {
      getStatus: jest
        .fn()
        .mockResolvedValueOnce(makeUnauthenticatedStatus())
        .mockResolvedValueOnce(
          makeAuthenticatedStatus({ displayAddress: '0xabc' }),
        ),
      startAppTransferLogin: jest.fn(async () => pairingResult),
    };

    await executeAuthLoginCommand({
      output: output as OutputFormatter,
      appTransferFlag: true,
      isHumanMode: true,
      isTTY: true,
      env: 'test',
      authManager,
      runAppTransferPairingDisplay,
      exit,
    });

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
    expect(output.error).not.toHaveBeenCalled();
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('waits for headless app transfer completion in agent mode and emits the structured login result', async () => {
    const pairingResult = makePairingResult();
    const waitForHeadlessAppTransferCompletion = jest.fn(async () => undefined);
    const authManager = {
      getStatus: jest
        .fn()
        .mockResolvedValueOnce(makeUnauthenticatedStatus())
        .mockResolvedValueOnce(
          makeAuthenticatedStatus({ displayAddress: '0xdef' }),
        ),
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

  it('rejects --app-transfer without a TTY before the pairing session starts', async () => {
    const authManager = {
      getStatus: jest.fn(async () => makeUnauthenticatedStatus()),
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

    expect(authManager.getStatus).not.toHaveBeenCalled();
    expect(authManager.startAppTransferLogin).not.toHaveBeenCalled();
    expect(authManager.getStatus).not.toHaveBeenCalled();
    expect(waitForHeadlessAppTransferCompletion).not.toHaveBeenCalled();
    expect(output.error).toHaveBeenCalledWith({
      code: ERROR_CODES.PARAM_REQUIRES_TTY.code,
      message: 'App Transfer login requires an interactive TTY terminal.',
      suggestion: 'Run this command in an interactive terminal.',
    });
    expect(process.exitCode).toBe(ERROR_CODES.PARAM_REQUIRES_TTY.exitCode);
    expect(exit).not.toHaveBeenCalled();
  });

  it('blocks --app-transfer login when an authenticated wallet already exists', async () => {
    const runAppTransferPairingDisplay = jest.fn(async () => undefined);
    const authManager = {
      getStatus: jest.fn(async () => makeAuthenticatedStatus()),
      startAppTransferLogin: jest.fn(async () => makePairingResult()),
    };

    await executeAuthLoginCommand({
      output: output as OutputFormatter,
      appTransferFlag: true,
      isHumanMode: true,
      isTTY: true,
      authManager,
      runAppTransferPairingDisplay,
      exit,
    });

    expect(authManager.startAppTransferLogin).not.toHaveBeenCalled();
    expect(runAppTransferPairingDisplay).not.toHaveBeenCalled();
    expect(output.error).toHaveBeenCalledWith({
      code: ERROR_CODES.AUTH_WALLET_EXISTS.code,
      message:
        'Wallet already exists. Log out before importing another wallet.',
      suggestion: 'Run: onekey auth logout',
    });
    expect(process.exitCode).toBe(ERROR_CODES.AUTH_WALLET_EXISTS.exitCode);
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
      code: ERROR_CODES.AUTH_TRANSFER_TIMEOUT.code,
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
    expect(process.exitCode).toBe(ERROR_CODES.AUTH_TRANSFER_TIMEOUT.exitCode);
    expect(exit).toHaveBeenCalledWith(
      ERROR_CODES.AUTH_TRANSFER_TIMEOUT.exitCode,
    );
  });

  it('reports structured cancellation guidance when headless app transfer is cancelled', async () => {
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
      code: ERROR_CODES.AUTH_TRANSFER_CANCELLED.code,
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
    expect(process.exitCode).toBe(ERROR_CODES.AUTH_TRANSFER_CANCELLED.exitCode);
    expect(exit).toHaveBeenCalledWith(
      ERROR_CODES.AUTH_TRANSFER_CANCELLED.exitCode,
    );
  });

  it('propagates cancellation from the interactive pairing display with structured retry guidance', async () => {
    const pairingResult = makePairingResult();
    const runAppTransferPairingDisplay = jest.fn(async () => {
      throw new AppError(
        ERROR_CODES.AUTH_TRANSFER_CANCELLED.code,
        'Transfer cancelled.',
        'Retry the App Transfer login flow',
      );
    });
    const authManager = {
      getStatus: jest.fn(async () => makeUnauthenticatedStatus()),
      startAppTransferLogin: jest.fn(async () => pairingResult),
    };

    await executeAuthLoginCommand({
      output: output as OutputFormatter,
      appTransferFlag: true,
      isHumanMode: true,
      isTTY: true,
      authManager,
      runAppTransferPairingDisplay,
      exit,
    });

    expect(runAppTransferPairingDisplay).toHaveBeenCalledWith(pairingResult);
    expect(output.error).toHaveBeenCalledWith({
      code: ERROR_CODES.AUTH_TRANSFER_CANCELLED.code,
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
    expect(process.exitCode).toBe(ERROR_CODES.AUTH_TRANSFER_CANCELLED.exitCode);
    expect(exit).toHaveBeenCalledWith(
      ERROR_CODES.AUTH_TRANSFER_CANCELLED.exitCode,
    );
  });

  it('fails with AUTH_SESSION_INVALID when app transfer completes without a valid session', async () => {
    const pairingResult = makePairingResult();
    const runAppTransferPairingDisplay = jest.fn(async () => undefined);
    const authManager = {
      getStatus: jest
        .fn()
        // First call: unauthenticated (pre-login check)
        .mockResolvedValueOnce(makeUnauthenticatedStatus())
        // Second call: still unauthenticated even after pairing completes
        .mockResolvedValueOnce(makeUnauthenticatedStatus()),
      startAppTransferLogin: jest.fn(async () => pairingResult),
    };

    await executeAuthLoginCommand({
      output: output as OutputFormatter,
      appTransferFlag: true,
      isHumanMode: true,
      isTTY: true,
      authManager,
      runAppTransferPairingDisplay,
      exit,
    });

    expect(runAppTransferPairingDisplay).toHaveBeenCalledWith(pairingResult);
    expect(output.error).toHaveBeenCalledWith(
      expect.objectContaining({
        code: ERROR_CODES.AUTH_SESSION_INVALID.code,
        message: 'App Transfer completed without a valid auth session',
        suggestion: 'Retry the App Transfer login flow',
      }),
    );
    expect(output.success).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(ERROR_CODES.AUTH_SESSION_INVALID.exitCode);
    expect(exit).toHaveBeenCalledWith(
      ERROR_CODES.AUTH_SESSION_INVALID.exitCode,
    );
  });

  it('registers an interruption cleanup that clears the session when triggered externally', async () => {
    const pairingResult = makePairingResult();
    // Trigger the active cleanup mid-flow by waiting for it to fire during the display.
    const clearSession = jest.fn(async () => undefined);
    let triggeredCleanup: Promise<void> | null = null;
    const runAppTransferPairingDisplay = jest.fn(async () => {
      triggeredCleanup = runActiveAuthFlowCleanup();
      await triggeredCleanup;
    });
    const authManager = {
      getStatus: jest
        .fn()
        .mockResolvedValueOnce(makeUnauthenticatedStatus())
        .mockResolvedValueOnce(
          makeAuthenticatedStatus({ displayAddress: '0xabc' }),
        ),
      clearSession,
      startAppTransferLogin: jest.fn(async () => pairingResult),
    };

    await executeAuthLoginCommand({
      output: output as OutputFormatter,
      appTransferFlag: true,
      isHumanMode: true,
      isTTY: true,
      authManager,
      runAppTransferPairingDisplay,
      exit,
    });

    expect(triggeredCleanup).not.toBeNull();
    expect(clearSession).toHaveBeenCalledTimes(1);
    expect(output.success).toHaveBeenCalled();
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('skips interruption cleanup registration when authManager has no clearSession implementation', async () => {
    // Pre-register a sentinel cleanup to confirm the command does NOT override it
    // when clearSession is undefined.
    const sentinelCleanup = jest.fn(async () => undefined);
    const release = registerActiveAuthFlowCleanup(sentinelCleanup);

    const pairingResult = makePairingResult();
    const runAppTransferPairingDisplay = jest.fn(async () => undefined);
    const authManager = {
      getStatus: jest
        .fn()
        .mockResolvedValueOnce(makeUnauthenticatedStatus())
        .mockResolvedValueOnce(
          makeAuthenticatedStatus({ displayAddress: '0xabc' }),
        ),
      startAppTransferLogin: jest.fn(async () => pairingResult),
    };

    await executeAuthLoginCommand({
      output: output as OutputFormatter,
      appTransferFlag: true,
      isHumanMode: true,
      isTTY: true,
      authManager,
      runAppTransferPairingDisplay,
      exit,
    });

    // Sentinel should still be the active cleanup since the command skipped registration.
    await runActiveAuthFlowCleanup();
    expect(sentinelCleanup).toHaveBeenCalledTimes(1);

    release();
  });

  describe('default waitForHeadlessCompletion wrapper', () => {
    // These tests omit the waitForHeadlessAppTransferCompletion override so the
    // SUT's default wrapper runs. The wrapper decides whether to write the
    // pairing instructions to stderr based on output.getMode() and stderr.isTTY.

    it('skips writing pairing instructions in agent mode when stderr is not a TTY', async () => {
      const pairingResult = makePairingResult();
      mockedGetActiveRuntime.mockReturnValue(
        makeCompletedRuntime(pairingResult.pairingCode),
      );
      const stderr: {
        isTTY: boolean;
        write: jest.Mock<boolean, [string | Uint8Array]>;
      } = {
        isTTY: false,
        write: jest.fn<boolean, [string | Uint8Array]>(() => true),
      };
      const authManager = {
        getStatus: jest
          .fn()
          .mockResolvedValueOnce(makeUnauthenticatedStatus())
          .mockResolvedValueOnce(
            makeAuthenticatedStatus({ displayAddress: '0xdef' }),
          ),
        startAppTransferLogin: jest.fn(async () => pairingResult),
      };

      await executeAuthLoginCommand({
        output: output as OutputFormatter,
        appTransferFlag: true,
        isHumanMode: false,
        isTTY: true,
        env: 'test',
        authManager,
        stderr,
        exit,
      });

      expect(stderr.write).not.toHaveBeenCalled();
      expect(output.success).toHaveBeenCalled();
      expect(exit).toHaveBeenCalledWith(0);
    });

    it('writes pairing instructions in agent mode when stderr is a TTY', async () => {
      const pairingResult = makePairingResult();
      mockedGetActiveRuntime.mockReturnValue(
        makeCompletedRuntime(pairingResult.pairingCode),
      );
      const stderr: {
        isTTY: boolean;
        write: jest.Mock<boolean, [string | Uint8Array]>;
      } = {
        isTTY: true,
        write: jest.fn<boolean, [string | Uint8Array]>(() => true),
      };
      const authManager = {
        getStatus: jest
          .fn()
          .mockResolvedValueOnce(makeUnauthenticatedStatus())
          .mockResolvedValueOnce(
            makeAuthenticatedStatus({ displayAddress: '0xdef' }),
          ),
        startAppTransferLogin: jest.fn(async () => pairingResult),
      };

      await executeAuthLoginCommand({
        output: output as OutputFormatter,
        appTransferFlag: true,
        isHumanMode: false,
        isTTY: true,
        env: 'test',
        authManager,
        stderr,
        exit,
      });

      expect(stderr.write).toHaveBeenCalledTimes(1);
      const writtenChunk = stderr.write.mock.calls[0][0];
      expect(String(writtenChunk)).toContain('Pairing code:');
      expect(String(writtenChunk)).toContain(pairingResult.pairingCode);
      expect(output.success).toHaveBeenCalled();
      expect(exit).toHaveBeenCalledWith(0);
    });
  });
});
