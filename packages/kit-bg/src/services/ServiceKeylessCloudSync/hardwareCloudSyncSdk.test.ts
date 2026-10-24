import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { deriveHardwareCloudSyncCredential } from './hardwareCloudSyncCredential';
import { generateHardwareCloudSyncCredentialWithSdk } from './hardwareCloudSyncSdk';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type { IDBDevice, IDBWallet } from '../../dbs/local/types';

const mockGetWallet = jest.fn<Promise<IDBWallet>, [{ walletId: string }]>();
const mockGetDevice = jest.fn<Promise<IDBDevice>, [string]>();

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isDev: true, isDesktop: true, isNative: false },
}));

jest.mock('@onekeyhq/shared/src/appCrypto', () => {
  const { createHash } = jest.requireActual<typeof import('crypto')>('crypto');
  return {
    __esModule: true,
    default: {
      hash: {
        sha256Sync: (input: Uint8Array) =>
          createHash('sha256').update(input).digest(),
      },
    },
  };
});

jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  __esModule: true,
  default: {
    isHwWallet: ({ walletId }: { walletId: string }) =>
      walletId.startsWith('hw-'),
  },
}));

jest.mock('../../dbs/local/localDb', () => ({
  __esModule: true,
  default: {
    getWallet: (params: { walletId: string }) => mockGetWallet(params),
    getDevice: (deviceId: string) => mockGetDevice(deviceId),
  },
}));

jest.mock('./hardwareCloudSyncCredential', () => ({
  deriveHardwareCloudSyncCredential: jest.fn(),
  normalizeHardwareCloudWalletXfp: (xfp: string) => xfp,
}));

const walletXfp = `00001234--xpub${'A'.repeat(107)}`;
const mockCredential = {
  keylessWalletId: 'placeholder',
  signingPrivateKey: 'synthetic-test-signing-key',
  signingPublicKey: 'synthetic-test-public-key',
  encryptionKey: 'synthetic-test-encryption-key',
  pwdHash: 'keyless-synthetic-test-hash',
};

function buildBackgroundApi() {
  const sdk = {
    openWalletSession: jest.fn(async () => ({
      success: true,
      payload: {
        walletType: 'standard',
        deviceId: 'test-device',
        passphraseState: null as string | null,
      },
    })),
    btcGetPublicKey: jest.fn(async () => ({
      success: true,
      payload: { node: { public_key: 'synthetic-test-public-key' } },
    })),
    btcGetAddress: jest.fn(async () => ({
      success: true,
      payload: { address: 'synthetic-test-address' },
    })),
    btcSignMessage: jest.fn(async () => ({
      success: true,
      payload: {
        signature: 'synthetic-test-signature',
        address: 'synthetic-test-address',
      },
    })),
  };
  const hardware = {
    getCompatibleConnectId: jest.fn(async () => 'test-connect'),
    getSDKInstance: jest.fn(async () => sdk),
    getDeviceState: jest.fn(async () => ({
      identity: { deviceId: 'test-device' },
      status: { unlocked: true, unlockedAttachPin: false },
    })),
    buildHwWalletXfp: jest.fn(async () => walletXfp),
    runWithSensitiveCloudKeyOperation: jest.fn(
      async <T>(operation: () => Promise<T>) => operation(),
    ),
  };
  const ui = {
    runExclusiveOneKeyOperation: jest.fn(
      async <T>(operation: (lease: { signal: AbortSignal }) => Promise<T>) =>
        operation({ signal: new AbortController().signal }),
    ),
  };
  return {
    sdk,
    hardware,
    ui,
    backgroundApi: {
      serviceHardware: hardware,
      serviceHardwareUI: ui,
    } as unknown as IBackgroundApi,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetWallet.mockResolvedValue({
    id: 'hw-standard',
    associatedDevice: 'db-test-device',
    xfp: walletXfp,
  } as IDBWallet);
  mockGetDevice.mockResolvedValue({
    id: 'db-test-device',
    deviceId: 'test-device',
    connectId: 'test-connect',
  } as IDBDevice);
  jest
    .mocked(deriveHardwareCloudSyncCredential)
    .mockImplementation(async ({ adapter, credentialId }) => {
      await adapter.openStandardWallet();
      await adapter.getIdentity();
      await adapter.signMessage({
        path: "m/44'/0'/100'/0/0",
        messageHex: '616263',
        coin: 'Bitcoin',
        useEmptyPassphrase: true,
      });
      return { ...mockCredential, keylessWalletId: credentialId };
    });
});

describe('hardware Cloud SDK adapter', () => {
  test('resolves a changed USB/BLE handle before opening the captured session', async () => {
    const { backgroundApi, sdk, hardware } = buildBackgroundApi();
    hardware.getCompatibleConnectId.mockResolvedValue(
      'current-transport-handle',
    );
    await generateHardwareCloudSyncCredentialWithSdk({
      backgroundApi,
      walletId: 'hw-standard',
      isCurrent: () => true,
    });
    expect(sdk.openWalletSession).toHaveBeenCalledWith(
      'current-transport-handle',
      { mode: 'standard' },
    );
    expect(sdk.btcSignMessage).toHaveBeenCalledWith(
      'current-transport-handle',
      'test-device',
      expect.objectContaining({ useEmptyPassphrase: true }),
    );
    expect(hardware.getDeviceState).toHaveBeenCalledWith(
      expect.objectContaining({ connectId: 'current-transport-handle' }),
    );
  });

  test('uses the standard session, reserved Bitcoin path and shared sensitive scope', async () => {
    const { backgroundApi, sdk, hardware, ui } = buildBackgroundApi();
    const result = await generateHardwareCloudSyncCredentialWithSdk({
      backgroundApi,
      walletId: 'hw-standard',
      isCurrent: () => true,
    });
    expect(sdk.openWalletSession).toHaveBeenCalledWith('test-connect', {
      mode: 'standard',
    });
    expect(sdk.btcGetPublicKey).toHaveBeenCalledWith(
      'test-connect',
      'test-device',
      expect.objectContaining({
        useEmptyPassphrase: true,
        path: "m/44'/0'/100'/0/0",
      }),
    );
    expect(sdk.btcSignMessage).toHaveBeenCalledWith(
      'test-connect',
      'test-device',
      expect.objectContaining({ useEmptyPassphrase: true, coin: 'Bitcoin' }),
    );
    expect(hardware.runWithSensitiveCloudKeyOperation).toHaveBeenCalledTimes(1);
    expect(ui.runExclusiveOneKeyOperation).toHaveBeenCalledWith(
      expect.any(Function),
      { deviceKey: 'db-test-device' },
    );
    expect(result.source).toMatchObject({
      type: 'hardware',
      walletId: 'hw-standard',
      walletXfp,
      derivationVersion: 1,
    });
    expect(result.credential.source).toEqual(result.source);
    expect(result.credential.keylessWalletId).toBe(result.source.credentialId);
  });

  test.each([
    {
      walletType: 'hidden',
      deviceId: 'test-device',
      passphraseState: 'hidden',
    },
    {
      walletType: 'standard',
      deviceId: 'replacement-device',
      passphraseState: null,
    },
  ])(
    'rejects an unsafe selected session before signing: %j',
    async (session) => {
      const { backgroundApi, sdk } = buildBackgroundApi();
      sdk.openWalletSession.mockResolvedValue({
        success: true,
        payload: session,
      });
      await expect(
        generateHardwareCloudSyncCredentialWithSdk({
          backgroundApi,
          walletId: 'hw-standard',
          isCurrent: () => true,
        }),
      ).rejects.toThrow('Hardware Cloud key could not be unlocked');
      expect(sdk.btcSignMessage).not.toHaveBeenCalled();
    },
  );

  test('rejects an Attach PIN live status before requesting a signature', async () => {
    const { backgroundApi, hardware, sdk } = buildBackgroundApi();
    hardware.getDeviceState.mockResolvedValue({
      identity: { deviceId: 'test-device' },
      status: { unlocked: true, unlockedAttachPin: true },
    });
    await expect(
      generateHardwareCloudSyncCredentialWithSdk({
        backgroundApi,
        walletId: 'hw-standard',
        isCurrent: () => true,
      }),
    ).rejects.toThrow('Hardware Cloud key could not be unlocked');
    expect(sdk.btcSignMessage).not.toHaveBeenCalled();
  });

  test('rejects a standard XFP mismatch before requesting a signature', async () => {
    const { backgroundApi, hardware, sdk } = buildBackgroundApi();
    hardware.buildHwWalletXfp.mockResolvedValue('different-standard-wallet');
    await expect(
      generateHardwareCloudSyncCredentialWithSdk({
        backgroundApi,
        walletId: 'hw-standard',
        isCurrent: () => true,
      }),
    ).rejects.toThrow('Hardware Cloud key could not be unlocked');
    expect(sdk.btcSignMessage).not.toHaveBeenCalled();
  });

  test('does not return SDK request/response data on cancellation', async () => {
    const { backgroundApi, sdk } = buildBackgroundApi();
    sdk.btcSignMessage.mockRejectedValue({
      message: 'synthetic-sensitive-data',
      signature: 'synthetic-secret',
    });
    await expect(
      generateHardwareCloudSyncCredentialWithSdk({
        backgroundApi,
        walletId: 'hw-standard',
        isCurrent: () => true,
      }),
    ).rejects.toThrow('Hardware Cloud key could not be unlocked');
  });

  test('checks operation freshness before touching the SDK', async () => {
    const { backgroundApi, sdk } = buildBackgroundApi();
    await expect(
      generateHardwareCloudSyncCredentialWithSdk({
        backgroundApi,
        walletId: 'hw-standard',
        isCurrent: () => false,
      }),
    ).rejects.toThrow('Hardware Cloud key could not be unlocked');
    expect(sdk.openWalletSession).not.toHaveBeenCalled();
  });

  test('does not offer unvalidated firmware on production builds', async () => {
    const { backgroundApi, sdk } = buildBackgroundApi();
    const originalDev = platformEnv.isDev;
    Object.defineProperty(platformEnv, 'isDev', {
      value: false,
      configurable: true,
    });
    try {
      await expect(
        generateHardwareCloudSyncCredentialWithSdk({
          backgroundApi,
          walletId: 'hw-standard',
          isCurrent: () => true,
        }),
      ).rejects.toThrow('local hardware compatibility validation');
      expect(sdk.openWalletSession).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(platformEnv, 'isDev', {
        value: originalDev,
        configurable: true,
      });
    }
  });
});
