import { createHash } from 'crypto';

import {
  HARDWARE_CLOUD_SYNC_AUTH_PATH,
  HARDWARE_CLOUD_SYNC_PATH,
} from '@onekeyhq/shared/src/consts/hardwareCloudSyncConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { deriveHardwareCloudSyncKek } from './hardwareCloudSyncCredential';
import { generateHardwareCloudSyncCredentialWithSdk } from './hardwareCloudSyncSdk';

import type { IHardwareCloudKeyUnlock } from './hardwareCloudSyncCredential';
import type { IBackgroundApi } from '../../apis/IBackgroundApi';

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isDev: false, isDesktop: true, isNative: false },
}));

jest.mock('@onekeyhq/shared/src/appCrypto', () => {
  const nodeCrypto = jest.requireActual<typeof import('crypto')>('crypto');
  return {
    __esModule: true,
    default: {
      hash: {
        sha256Sync: (input: Uint8Array) =>
          nodeCrypto.createHash('sha256').update(input).digest(),
      },
    },
  };
});

jest.mock('@onekeyhq/shared/src/utils/deviceUtils', () => ({
  __esModule: true,
  default: {
    getDeviceDisplayName: ({
      state,
    }: {
      state: { identity: { label: string } };
    }) => state.identity.label,
  },
}));

jest.mock('./hardwareCloudSyncCredential', () => ({
  deriveHardwareCloudSyncKek: jest.fn(),
  normalizeHardwareCloudWalletXfp: (xfp: string) => xfp,
}));

const walletXfp = `00001234--xpub${'A'.repeat(107)}`;
const standardCredentialId = `hardware-cloud-v1-${createHash('sha256')
  .update(walletXfp, 'utf8')
  .digest('hex')}`;
const mockCredential = {
  keylessWalletId: 'placeholder',
  signingPrivateKey: '',
  signingPublicKey: '',
  encryptionKey: 'synthetic-test-encryption-key',
  pwdHash: 'hw-dek-synthetic-test-hash',
};
const TEST_SALT = '00112233445566778899aabbccddeeff';
// Like the service: derive the KEK for an envelope salt inside the session.
const unlock: IHardwareCloudKeyUnlock = async (device) => {
  await device.deriveKek(TEST_SALT);
  return { ...mockCredential, keylessWalletId: device.credentialId };
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
      identity: {
        deviceId: 'test-device',
        label: 'My OneKey',
        deviceType: 'pro',
      },
      status: { unlocked: true, unlockedAttachPin: false },
    })),
    buildHwWalletXfp: jest.fn(async () => walletXfp),
    runWithSensitiveCloudKeyOperation: jest.fn(
      async <T>(operation: () => Promise<T>) => operation(),
    ),
    cancel: jest.fn(async () => undefined),
  };
  const controller = new AbortController();
  const lease = { signal: controller.signal };
  const ui = {
    hardwareProcessingManager: {
      cancelOneKeyOperation: jest.fn((_lease: unknown) => controller.abort()),
    },
    runExclusiveOneKeyOperation: jest.fn(
      async <T>(operation: (value: typeof lease) => Promise<T>) =>
        operation(lease),
    ),
  };
  return {
    sdk,
    hardware,
    ui,
    lease,
    backgroundApi: {
      serviceHardware: hardware,
      serviceHardwareUI: ui,
    } as unknown as IBackgroundApi,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(deriveHardwareCloudSyncKek)
    .mockImplementation(async ({ adapter }) => {
      await adapter.openStandardWallet();
      await adapter.getIdentity();
      await adapter.signMessage({
        path: HARDWARE_CLOUD_SYNC_PATH,
        messageHex: '616263',
        coin: 'Bitcoin',
        useEmptyPassphrase: true,
      });
      return 'synthetic-test-kek';
    });
});

describe('hardware Cloud SDK adapter', () => {
  test('resolves a changed USB/BLE handle before opening the captured session', async () => {
    const { backgroundApi, sdk, hardware } = buildBackgroundApi();
    hardware.getCompatibleConnectId.mockResolvedValue(
      'current-transport-handle',
    );
    await generateHardwareCloudSyncCredentialWithSdk({
      unlock,
      backgroundApi,
      connectId: 'test-connect',
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
      unlock,
      backgroundApi,
      connectId: 'test-connect',
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
        path: HARDWARE_CLOUD_SYNC_PATH,
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
      { deviceKey: 'test-connect' },
    );
    // No wallet record and no raw XFP: only its hash and display info.
    expect(result.source).toEqual({
      type: 'hardware',
      credentialId: standardCredentialId,
      derivationVersion: 1,
      deviceName: 'My OneKey',
      deviceType: 'pro',
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
          unlock,
          backgroundApi,
          connectId: 'test-connect',
          isCurrent: () => true,
        }),
      ).rejects.toThrow('Hardware Cloud key could not be unlocked');
      expect(sdk.btcSignMessage).not.toHaveBeenCalled();
    },
  );

  test('rejects an Attach PIN live status before requesting a signature', async () => {
    const { backgroundApi, hardware, sdk } = buildBackgroundApi();
    hardware.getDeviceState.mockResolvedValue({
      identity: {
        deviceId: 'test-device',
        label: 'My OneKey',
        deviceType: 'pro',
      },
      status: { unlocked: true, unlockedAttachPin: true },
    });
    await expect(
      generateHardwareCloudSyncCredentialWithSdk({
        unlock,
        backgroundApi,
        connectId: 'test-connect',
        isCurrent: () => true,
      }),
    ).rejects.toThrow('Hardware Cloud key could not be unlocked');
    expect(sdk.btcSignMessage).not.toHaveBeenCalled();
  });

  test('rejects a standard wallet that changes during the operation', async () => {
    const { backgroundApi, hardware, sdk } = buildBackgroundApi();
    hardware.buildHwWalletXfp
      .mockResolvedValueOnce(walletXfp)
      .mockResolvedValue('different-standard-wallet');
    await expect(
      generateHardwareCloudSyncCredentialWithSdk({
        unlock,
        backgroundApi,
        connectId: 'test-connect',
        isCurrent: () => true,
      }),
    ).rejects.toThrow('Hardware Cloud key could not be unlocked');
    expect(sdk.btcSignMessage).not.toHaveBeenCalled();
  });

  test('another recovery phrase is rejected before the device signs', async () => {
    const { backgroundApi, sdk } = buildBackgroundApi();
    await expect(
      generateHardwareCloudSyncCredentialWithSdk({
        unlock,
        backgroundApi,
        connectId: 'test-connect',
        expectedCredentialId: 'hardware-cloud-v1-another-recovery-phrase',
        isCurrent: () => true,
      }),
    ).rejects.toThrow("doesn't match the one used for Cloud sync");
    expect(sdk.btcGetPublicKey).not.toHaveBeenCalled();
    expect(sdk.btcSignMessage).not.toHaveBeenCalled();
  });

  test('a device restored from the same recovery phrase signs again', async () => {
    const { backgroundApi, sdk } = buildBackgroundApi();
    const result = await generateHardwareCloudSyncCredentialWithSdk({
      unlock,
      backgroundApi,
      connectId: 'test-connect',
      expectedCredentialId: standardCredentialId,
      isCurrent: () => true,
    });
    expect(sdk.btcSignMessage).toHaveBeenCalled();
    expect(result.source.credentialId).toBe(standardCredentialId);
  });

  test('shows a firmware path rejection instead of the generic error', async () => {
    const { backgroundApi, sdk } = buildBackgroundApi();
    sdk.btcGetAddress.mockResolvedValue({
      success: false,
      payload: { error: 'Failure_DataError,Forbidden key path' },
    } as never);
    await expect(
      generateHardwareCloudSyncCredentialWithSdk({
        unlock,
        backgroundApi,
        connectId: 'test-connect',
        isCurrent: () => true,
      }),
    ).rejects.toThrow(
      `The device rejected the derivation path ${HARDWARE_CLOUD_SYNC_PATH} (Forbidden key path)`,
    );
    expect(sdk.btcSignMessage).not.toHaveBeenCalled();
  });

  test('keeps other SDK failures generic', async () => {
    const { backgroundApi, sdk } = buildBackgroundApi();
    sdk.btcGetPublicKey.mockResolvedValue({
      success: false,
      payload: { error: 'synthetic transport detail' },
    } as never);
    await expect(
      generateHardwareCloudSyncCredentialWithSdk({
        unlock,
        backgroundApi,
        connectId: 'test-connect',
        isCurrent: () => true,
      }),
    ).rejects.toThrow('Hardware Cloud key could not be unlocked');
  });

  test('does not return SDK request/response data on cancellation', async () => {
    const { backgroundApi, sdk } = buildBackgroundApi();
    sdk.btcSignMessage.mockRejectedValue({
      message: 'synthetic-sensitive-data',
      signature: 'synthetic-secret',
    });
    await expect(
      generateHardwareCloudSyncCredentialWithSdk({
        unlock,
        backgroundApi,
        connectId: 'test-connect',
        isCurrent: () => true,
      }),
    ).rejects.toThrow('Hardware Cloud key could not be unlocked');
  });

  test('Cancel aborts the hardware lease and the in-flight SDK request', async () => {
    const { backgroundApi, sdk, hardware, ui, lease } = buildBackgroundApi();
    const cancelCallbacks: Array<(() => void) | undefined> = [];
    sdk.btcSignMessage.mockImplementation(async () => {
      // The user presses Cancel while the device shows the message.
      cancelCallbacks[cancelCallbacks.length - 1]?.();
      return {
        success: true,
        payload: {
          signature: 'synthetic-test-signature',
          address: 'synthetic-test-address',
        },
      };
    });
    await expect(
      generateHardwareCloudSyncCredentialWithSdk({
        unlock,
        backgroundApi,
        connectId: 'test-connect',
        isCurrent: () => true,
        onDeviceCancelChange: (cancel) => cancelCallbacks.push(cancel),
      }),
    ).rejects.toThrow('Hardware Cloud key could not be unlocked');
    expect(
      ui.hardwareProcessingManager.cancelOneKeyOperation,
    ).toHaveBeenCalledWith(lease);
    expect(hardware.cancel).toHaveBeenCalledWith({
      connectId: 'test-connect',
      oneKeyOperationLease: lease,
      immediate: true,
    });
    expect(cancelCallbacks).toHaveLength(2);
    expect(cancelCallbacks[1]).toBeUndefined();
  });

  test('unregisters the device canceller once the request settles', async () => {
    const { backgroundApi, hardware } = buildBackgroundApi();
    const cancelCallbacks: Array<(() => void) | undefined> = [];
    await generateHardwareCloudSyncCredentialWithSdk({
      unlock,
      backgroundApi,
      connectId: 'test-connect',
      isCurrent: () => true,
      onDeviceCancelChange: (cancel) => cancelCallbacks.push(cancel),
    });
    expect(cancelCallbacks).toEqual([expect.any(Function), undefined]);
    expect(hardware.cancel).not.toHaveBeenCalled();
  });

  test('checks operation freshness before touching the SDK', async () => {
    const { backgroundApi, sdk } = buildBackgroundApi();
    await expect(
      generateHardwareCloudSyncCredentialWithSdk({
        unlock,
        backgroundApi,
        connectId: 'test-connect',
        isCurrent: () => false,
      }),
    ).rejects.toThrow('Hardware Cloud key could not be unlocked');
    expect(sdk.openWalletSession).not.toHaveBeenCalled();
  });

  test('an unsupported runtime fails closed', async () => {
    const { backgroundApi, sdk } = buildBackgroundApi();
    const originalDesktop = platformEnv.isDesktop;
    Object.defineProperty(platformEnv, 'isDesktop', {
      value: false,
      configurable: true,
    });
    try {
      await expect(
        generateHardwareCloudSyncCredentialWithSdk({
          unlock,
          backgroundApi,
          connectId: 'test-connect',
          isCurrent: () => true,
        }),
      ).rejects.toThrow('not available here');
      expect(sdk.openWalletSession).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(platformEnv, 'isDesktop', {
        value: originalDesktop,
        configurable: true,
      });
    }
  });

  test('signs in on P_auth before the KEK, in one device session', async () => {
    const { backgroundApi, sdk, ui } = buildBackgroundApi();
    const nonce = 'ab'.repeat(32);
    const order: string[] = [];
    sdk.btcSignMessage.mockImplementation(async (...args: unknown[]) => {
      order.push((args[2] as { path: string }).path);
      return {
        success: true,
        payload: {
          signature: 'aa'.repeat(65),
          address: 'synthetic-test-address',
        },
      };
    });
    await generateHardwareCloudSyncCredentialWithSdk({
      unlock: async (device) => {
        await device.signAuth(
          `OneKey Cloud Sync sign-in\nOnly confirm this inside the OneKey App.\nNonce: ${nonce}\nDevice: abcd1234`,
        );
        await device.deriveKek(TEST_SALT);
        return { ...mockCredential, keylessWalletId: device.credentialId };
      },
      backgroundApi,
      connectId: 'test-connect',
      isCurrent: () => true,
    });
    expect(order).toEqual([
      HARDWARE_CLOUD_SYNC_AUTH_PATH,
      HARDWARE_CLOUD_SYNC_PATH,
    ]);
    expect(ui.runExclusiveOneKeyOperation).toHaveBeenCalledTimes(1);
  });

  test('refuses to sign a challenge that is not a sign-in message', async () => {
    const { backgroundApi, sdk } = buildBackgroundApi();
    await expect(
      generateHardwareCloudSyncCredentialWithSdk({
        unlock: async (device) => {
          await device.signAuth('Sign anything');
          return mockCredential;
        },
        backgroundApi,
        connectId: 'test-connect',
        isCurrent: () => true,
      }),
    ).rejects.toThrow('Hardware Cloud key could not be unlocked');
    expect(sdk.btcSignMessage).not.toHaveBeenCalled();
  });

  test("passes the caller's own errors through unchanged", async () => {
    const { backgroundApi } = buildBackgroundApi();
    const serverError = new Error('Cloud sync key changed. Sync again first.');
    await expect(
      generateHardwareCloudSyncCredentialWithSdk({
        unlock: async () => {
          throw serverError;
        },
        backgroundApi,
        connectId: 'test-connect',
        isCurrent: () => true,
      }),
    ).rejects.toBe(serverError);
  });
});
