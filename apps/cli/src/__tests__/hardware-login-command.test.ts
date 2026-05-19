import { ERROR_CODES } from '../errors';

import type { ResolvedAuthSession } from '../core/auth/auth-types';
import type { OutputFormatter } from '../output';

jest.mock('../commands/device/hardware-sdk', () => ({
  __testMocks: {
    mockSearchDevice: jest.fn(),
    mockEnsureSDKReady: jest.fn(),
    mockResolvePassphraseState: jest.fn(),
    mockUnwrapSDKResult: jest.fn(
      <T>(result: { success: boolean; payload: T }): T => {
        return result.payload;
      },
    ),
  },
  CoreSDKLoader: jest.fn(async () => ({
    preloadSessionCache: jest.fn(),
  })),
  ensureSDKReady: (...args: unknown[]) => {
    const mocks = jest.requireMock('../commands/device/hardware-sdk')
      .__testMocks as IHardwareSdkTestMocks;
    return mocks.mockEnsureSDKReady(...args) as Promise<unknown>;
  },
  resolvePassphraseState: (...args: unknown[]) => {
    const mocks = jest.requireMock('../commands/device/hardware-sdk')
      .__testMocks as IHardwareSdkTestMocks;
    return mocks.mockResolvePassphraseState(...args) as Promise<string>;
  },
  searchDevice: (...args: unknown[]) => {
    const mocks = jest.requireMock('../commands/device/hardware-sdk')
      .__testMocks as IHardwareSdkTestMocks;
    return mocks.mockSearchDevice(...args) as Promise<unknown>;
  },
  unwrapSDKResult: (...args: unknown[]) => {
    const mocks = jest.requireMock('../commands/device/hardware-sdk')
      .__testMocks as IHardwareSdkTestMocks;
    return mocks.mockUnwrapSDKResult(...args) as unknown;
  },
}));

interface IHardwareSdkTestMocks {
  mockSearchDevice: jest.Mock;
  mockEnsureSDKReady: jest.Mock;
  mockResolvePassphraseState: jest.Mock;
  mockUnwrapSDKResult: jest.Mock;
}

const { executeHardwareLoginCommand } =
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('../commands/auth/hardware-login-command') as typeof import('../commands/auth/hardware-login-command');
const hardwareSdkMocks =
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  (
    require('../commands/device/hardware-sdk') as {
      __testMocks: IHardwareSdkTestMocks;
    }
  ).__testMocks;

function makeOutputMock(): Pick<OutputFormatter, 'info' | 'success'> {
  return {
    info: jest.fn(),
    success: jest.fn(),
  };
}

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
    loginMethod: 'hardware',
    walletKind: 'hw',
    displayAddress: '0x1234567890abcdef1234567890abcdef12345678',
    importedAt: '2026-04-26T00:00:00.000Z',
    sourceLabel: 'Hardware: OneKey',
    device: {
      connectId: 'connect-1',
      deviceId: 'device-1',
      deviceLabel: 'OneKey',
    },
    passphraseMode: 'none',
  };
}

describe('executeHardwareLoginCommand passphrase mode selection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    hardwareSdkMocks.mockSearchDevice.mockResolvedValue({
      connectId: 'connect-1',
      deviceId: 'device-1',
    });
    hardwareSdkMocks.mockEnsureSDKReady.mockResolvedValue({
      getFeatures: jest.fn(async () => ({
        success: true,
        payload: {
          label: 'OneKey',
          unlocked: true,
          passphrase_protection: true,
        },
      })),
      evmGetAddress: jest.fn(async () => ({
        success: true,
        payload: {
          address: '0x1234567890abcdef1234567890abcdef12345678',
          path: "m/44'/60'/0'/0/0",
        },
      })),
      searchDevices: jest.fn(async () => ({ success: true, payload: [] })),
    });
  });

  it('rejects non-interactive hardware login when passphrase protection is enabled and mode is implicit', async () => {
    const output = makeOutputMock();
    const getStatus = jest.fn(async () => makeUnauthenticatedStatus());
    const persistSession = jest.fn(async () => undefined);

    await expect(
      executeHardwareLoginCommand({
        output: output as OutputFormatter,
        isTTY: false,
        isHumanMode: false,
        getStatus,
        persistSession,
      }),
    ).rejects.toMatchObject({
      code: ERROR_CODES.PARAM_REQUIRES_TTY.code,
      message:
        'Hardware passphrase protection is enabled, but this command cannot prompt for wallet type.',
    });

    expect(hardwareSdkMocks.mockResolvePassphraseState).not.toHaveBeenCalled();
    expect(persistSession).not.toHaveBeenCalled();
  });

  it('allows explicit standard-wallet mode in non-interactive hardware login', async () => {
    const output = makeOutputMock();
    const getStatus = jest
      .fn()
      .mockResolvedValueOnce(makeUnauthenticatedStatus())
      .mockResolvedValueOnce(makeAuthenticatedStatus());
    const persistSession = jest.fn(async () => undefined);

    await executeHardwareLoginCommand({
      output: output as OutputFormatter,
      isTTY: false,
      isHumanMode: false,
      passphraseMode: 'none',
      getStatus,
      persistSession,
    });

    const sdk = await hardwareSdkMocks.mockEnsureSDKReady.mock.results[0].value;
    expect(sdk.evmGetAddress).toHaveBeenCalledWith(
      'connect-1',
      'device-1',
      expect.objectContaining({
        useEmptyPassphrase: true,
      }),
    );
    expect(persistSession).toHaveBeenCalledWith(
      expect.objectContaining({
        session: expect.objectContaining({
          passphraseMode: 'none',
          loginMethod: 'hardware',
        }),
      }),
    );
    expect(output.success).toHaveBeenCalled();
  });

  it('rejects explicit hidden-wallet mode when device passphrase protection is disabled', async () => {
    const output = makeOutputMock();
    const getStatus = jest.fn(async () => makeUnauthenticatedStatus());
    const persistSession = jest.fn(async () => undefined);
    hardwareSdkMocks.mockEnsureSDKReady.mockResolvedValueOnce({
      getFeatures: jest.fn(async () => ({
        success: true,
        payload: {
          label: 'OneKey',
          unlocked: true,
          passphrase_protection: false,
        },
      })),
      evmGetAddress: jest.fn(),
      searchDevices: jest.fn(),
    });

    await expect(
      executeHardwareLoginCommand({
        output: output as OutputFormatter,
        isTTY: false,
        isHumanMode: false,
        passphraseMode: 'on-device',
        getStatus,
        persistSession,
      }),
    ).rejects.toMatchObject({
      code: ERROR_CODES.PARAM_INVALID_CONFIG.code,
      message:
        'Device passphrase protection is disabled, so hidden-wallet passphrase mode is unavailable.',
    });

    expect(hardwareSdkMocks.mockResolvePassphraseState).not.toHaveBeenCalled();
    expect(persistSession).not.toHaveBeenCalled();
  });
});
