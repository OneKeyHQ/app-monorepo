import { createHash } from 'crypto';

import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import {
  HARDWARE_CLOUD_SYNC_AUTH_PATH,
  HARDWARE_CLOUD_SYNC_PATH,
  buildHardwareCloudSyncAuthMessage,
  getHardwareCloudSyncIdentityTagFromCredentialId,
} from '@onekeyhq/shared/src/consts/hardwareCloudSyncConsts';
import { convertDeviceError } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import systemTimeUtils from '@onekeyhq/shared/src/utils/systemTimeUtils';

import { deriveHardwareCloudSyncKek } from './hardwareCloudSyncCredential';
import { generateHardwareCloudSyncCredentialWithSdk } from './hardwareCloudSyncSdk';

import type { IHardwareCloudKeyUnlock } from './hardwareCloudSyncCredential';
import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type { Success, Unsuccessful } from '@onekeyfe/hd-core';

const mockLog = jest.fn<void, [string]>();
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    app: { error: { log: (message: string) => mockLog(message) } },
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isDev: false,
    isDesktop: true,
    isNative: false,
    isExtension: false,
  },
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

jest.mock('@onekeyhq/shared/src/utils/systemTimeUtils', () => ({
  __esModule: true,
  default: { getEstimatedServerTime: jest.fn() },
}));

jest.mock('./hardwareCloudSyncCredential', () => ({
  deriveHardwareCloudSyncKek: jest.fn(),
  normalizeHardwareCloudWalletXfp: (xfp: string) => xfp,
}));

const walletXfp = `00001234--xpub${'A'.repeat(107)}`;
const standardCredentialId = `hardware-cloud-v1-${createHash('sha256')
  .update(walletXfp, 'utf8')
  .digest('hex')}`;
const AUTH_NOW = Date.parse('2030-01-01T00:00:00.000Z');
const authContext = {
  identityTag:
    getHardwareCloudSyncIdentityTagFromCredentialId(standardCredentialId),
  env: 'prod' as const,
  jkt: '0ZcOCORZNYy-DWpqq30jZyJGHTN0d2HglBV3uiguA4I',
};
const authMessage = buildHardwareCloudSyncAuthMessage({
  ...authContext,
  nonce: 'ab'.repeat(32),
  expires: '2030-01-01T00:05:00.000Z',
});
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

function buildBackgroundApi(
  status: {
    unlocked: boolean;
    attachToPinEnabled?: boolean;
    unlockedAttachPin?: boolean | null;
    passphraseProtection?: boolean;
  } = { unlocked: true, unlockedAttachPin: false },
) {
  const sdk = {
    openWalletSession: jest.fn(
      async (): Promise<
        | Success<{
            walletType: string;
            deviceId: string;
            passphraseState: string | null;
          }>
        | Unsuccessful
      > => ({
        success: true,
        payload: {
          walletType: 'standard',
          deviceId: 'test-device',
          passphraseState: null as string | null,
        },
      }),
    ),
    btcGetPublicKey: jest.fn(async () => ({
      success: true,
      payload: { node: { public_key: 'synthetic-test-public-key' } },
    })),
    btcGetAddress: jest.fn(async () => ({
      success: true,
      payload: { address: 'synthetic-test-address' },
    })),
    btcSignMessage: jest.fn(
      async (): Promise<
        Success<{ signature: string; address: string }> | Unsuccessful
      > => ({
        success: true,
        payload: {
          signature: 'synthetic-test-signature',
          address: 'synthetic-test-address',
        },
      }),
    ),
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
      status,
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
    deviceStageJoinBurst: jest.fn(async (_params: unknown) => undefined),
    deviceStageLeaveBurst: jest.fn(async (_params: unknown) => undefined),
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
    .spyOn(systemTimeUtils, 'getEstimatedServerTime')
    .mockReturnValue(AUTH_NOW);
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
  test('does not log a raw rejection string from the unlock callback', async () => {
    const sensitive = 'synthetic-private-callback-rejection';
    const rejectedUnlock = jest
      .fn<
        ReturnType<IHardwareCloudKeyUnlock>,
        Parameters<IHardwareCloudKeyUnlock>
      >()
      .mockRejectedValue(sensitive);
    const { backgroundApi } = buildBackgroundApi({
      unlocked: true,
      unlockedAttachPin: null,
      passphraseProtection: false,
    });
    await expect(
      generateHardwareCloudSyncCredentialWithSdk({
        unlock: rejectedUnlock,
        backgroundApi,
        connectId: 'test-connect',
        isCurrent: () => true,
      }),
    ).rejects.toBe(sensitive);
    expect(mockLog).toHaveBeenCalledTimes(1);
    expect(mockLog.mock.calls[0][0]).not.toContain(sensitive);
  });

  test.each(
    ['sign-in', 'key derivation'].flatMap((stage) =>
      [false, null, undefined].map((unlockedAttachPin) => ({
        stage,
        unlockedAttachPin,
      })),
    ),
  )(
    'preserves a device refusal during $stage signing with attach-PIN status $unlockedAttachPin',
    async ({ stage, unlockedAttachPin }) => {
      const { backgroundApi, sdk } = buildBackgroundApi({
        unlocked: true,
        unlockedAttachPin,
        passphraseProtection: false,
      });
      const payload = {
        code: HardwareErrorCode.ActionCancelled,
        error: 'Failure_ActionCancelled',
      };
      sdk.btcSignMessage.mockResolvedValueOnce({ success: false, payload });
      const selectedUnlock: IHardwareCloudKeyUnlock =
        stage === 'sign-in'
          ? async (device) => {
              await device.signAuth(authMessage, authContext);
              return mockCredential;
            }
          : unlock;
      await expect(
        generateHardwareCloudSyncCredentialWithSdk({
          unlock: selectedUnlock,
          backgroundApi,
          connectId: 'test-connect',
          isCurrent: () => true,
        }),
      ).rejects.toMatchObject(convertDeviceError(payload));
      expect(mockLog).toHaveBeenCalledWith(
        expect.stringContaining('[HardwareCloudSync] btcSignMessage.'),
      );
      expect(mockLog).toHaveBeenCalledWith(
        expect.stringContaining(`sdkCode=${payload.code}`),
      );
    },
  );

  test.each([
    HardwareErrorCode.ActionCancelled,
    HardwareErrorCode.DeviceNotFound,
    HardwareErrorCode.PinInvalid,
  ])(
    'uses the shared hardware error conversion for SDK code %s',
    async (code) => {
      const { backgroundApi, sdk } = buildBackgroundApi();
      const payload = { code, error: 'Failure_ActionCancelled' };
      sdk.openWalletSession.mockResolvedValueOnce({ success: false, payload });
      await expect(
        generateHardwareCloudSyncCredentialWithSdk({
          unlock,
          backgroundApi,
          connectId: 'test-connect',
          isCurrent: () => true,
        }),
      ).rejects.toMatchObject(convertDeviceError(payload));
    },
  );

  test('preserves an error already thrown by the hardware service', async () => {
    const { backgroundApi, hardware } = buildBackgroundApi();
    const error = convertDeviceError({
      code: HardwareErrorCode.DeviceNotFound,
      error: 'Device not found',
    });
    hardware.getCompatibleConnectId.mockRejectedValueOnce(error);
    await expect(
      generateHardwareCloudSyncCredentialWithSdk({
        unlock,
        backgroundApi,
        connectId: 'test-connect',
        isCurrent: () => true,
      }),
    ).rejects.toMatchObject({
      key: error.key,
      code: error.code,
      message: error.message,
      className: error.className,
    });
  });

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
    // No wallet record and no raw XFP: only its hash and display info. The
    // avatar is the account selector's image for this model, not the serial.
    expect(result.source).toEqual({
      type: 'hardware',
      credentialId: standardCredentialId,
      derivationVersion: 1,
      deviceName: 'My OneKey',
      deviceType: 'pro',
      deviceAvatar: 'proBlack',
    });
    expect(result.credential.source).toEqual(result.source);
    expect(result.credential.keylessWalletId).toBe(result.source.credentialId);
  });

  test.each([
    { unlockedAttachPin: null, passphraseProtection: false },
    { unlockedAttachPin: undefined, passphraseProtection: false },
    { unlockedAttachPin: null, passphraseProtection: true },
  ])('accepts a legacy standard-wallet status: %j', async (status) => {
    const { backgroundApi, sdk } = buildBackgroundApi({
      unlocked: true,
      ...status,
    });
    const result = await generateHardwareCloudSyncCredentialWithSdk({
      unlock,
      backgroundApi,
      connectId: 'test-connect',
      isCurrent: () => true,
    });
    expect(result.source.credentialId).toBe(standardCredentialId);
    expect(sdk.openWalletSession).toHaveBeenCalledWith('test-connect', {
      mode: 'standard',
    });
    expect(sdk.btcSignMessage).toHaveBeenCalledWith(
      'test-connect',
      'test-device',
      expect.objectContaining({ useEmptyPassphrase: true }),
    );
  });

  test.each([null, undefined])(
    'rejects a locked legacy wallet with attach-PIN status %s',
    async (unlockedAttachPin) => {
      const { backgroundApi, sdk } = buildBackgroundApi({
        unlocked: false,
        unlockedAttachPin,
        passphraseProtection: false,
      });
      await expect(
        generateHardwareCloudSyncCredentialWithSdk({
          unlock,
          backgroundApi,
          connectId: 'test-connect',
          isCurrent: () => true,
        }),
      ).rejects.toThrow('Couldn’t complete this action');
      expect(sdk.btcSignMessage).not.toHaveBeenCalled();
      expect(mockLog).toHaveBeenCalledWith(
        expect.stringContaining('Standard wallet runtime state invalid'),
      );
      expect(mockLog).toHaveBeenCalledWith(
        expect.stringContaining('"unlocked":false'),
      );
    },
  );

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
    {
      walletType: 'standard',
      deviceId: 'test-device',
      passphraseState: 'hidden',
    },
  ])(
    'rejects an unsafe selected session before signing: %j',
    async (session) => {
      const { backgroundApi, sdk } = buildBackgroundApi({
        unlocked: true,
        unlockedAttachPin: null,
        passphraseProtection: false,
      });
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
      ).rejects.toMatchObject({
        key:
          session.walletType === 'hidden' || session.passphraseState
            ? ETranslations.cloud_sync_hardware_hidden_wallet__msg
            : ETranslations.cloud_sync_hardware_unlock_failed__msg,
      });
      expect(sdk.btcSignMessage).not.toHaveBeenCalled();
    },
  );

  test.each(
    [
      HardwareErrorCode.DeviceCheckUnlockTypeError,
      HardwareErrorCode.DeviceCheckPassphraseStateError,
    ].flatMap((code) =>
      (['response', 'throw'] as const).map((kind) => ({ code, kind })),
    ),
  )(
    'a session refusal retains its shared hardware error and lands on DeviceStage ($code, $kind)',
    async ({ code, kind }) => {
      const { backgroundApi, sdk, hardware, ui } = buildBackgroundApi();
      const blockedUnlock = jest.fn(unlock);
      if (kind === 'response') {
        sdk.openWalletSession.mockResolvedValueOnce({
          success: false,
          payload: { code, error: 'Synthetic hidden-wallet refusal' },
        });
      } else {
        sdk.openWalletSession.mockRejectedValueOnce(
          convertDeviceError({ code }),
        );
      }
      await expect(
        generateHardwareCloudSyncCredentialWithSdk({
          unlock: blockedUnlock,
          backgroundApi,
          connectId: 'test-connect',
          isCurrent: () => true,
        }),
      ).rejects.toMatchObject({
        key: convertDeviceError({ code }).key,
        code,
        $isHardwareError: true,
        autoToast: false,
      });
      expect(ui.deviceStageLeaveBurst).toHaveBeenCalledWith({
        error: expect.objectContaining({ code, $isHardwareError: true }),
      });
      expect(hardware.getDeviceState).not.toHaveBeenCalled();
      expect(sdk.btcSignMessage).not.toHaveBeenCalled();
      expect(blockedUnlock).not.toHaveBeenCalled();
    },
  );

  test('Attach to PIN being configured does not block a standard PIN session', async () => {
    const { backgroundApi } = buildBackgroundApi({
      unlocked: true,
      unlockedAttachPin: false,
      attachToPinEnabled: true,
      passphraseProtection: true,
    });
    await expect(
      generateHardwareCloudSyncCredentialWithSdk({
        unlock,
        backgroundApi,
        connectId: 'test-connect',
        isCurrent: () => true,
      }),
    ).resolves.toHaveProperty('credential');
  });

  test('DeviceStage exit failure preserves the original hardware error and restores the toast fallback', async () => {
    const { backgroundApi, sdk, ui } = buildBackgroundApi();
    const original = convertDeviceError({ code: HardwareErrorCode.PinInvalid });
    original.autoToast = false;
    sdk.openWalletSession.mockRejectedValueOnce(original);
    ui.deviceStageLeaveBurst.mockRejectedValueOnce(
      new Error('Synthetic stage failure'),
    );
    await expect(
      generateHardwareCloudSyncCredentialWithSdk({
        unlock,
        backgroundApi,
        connectId: 'test-connect',
        isCurrent: () => true,
      }),
    ).rejects.toMatchObject({
      code: original.code,
      key: original.key,
      className: original.className,
      autoToast: true,
    });
  });

  test.each(
    [
      HardwareErrorCode.PinInvalid,
      HardwareErrorCode.DeviceCheckDeviceIdError,
      HardwareErrorCode.DeviceNotFound,
      HardwareErrorCode.BleUnavailableWhileUsbConnected,
      HardwareErrorCode.CallMethodNeedUpgradeFirmware,
      HardwareErrorCode.ActionCancelled,
    ].flatMap((code) =>
      (
        [
          'openWalletSession',
          'btcGetPublicKey',
          'btcGetAddress',
          'btcSignMessage',
        ] as const
      ).map((method) => ({ code, method })),
    ),
  )(
    'keeps the hardware failure across $method for code $code',
    async ({ code, method }) => {
      const { backgroundApi, sdk, ui } = buildBackgroundApi();
      const common = convertDeviceError({ code });
      sdk[method].mockRejectedValueOnce(common);
      await expect(
        generateHardwareCloudSyncCredentialWithSdk({
          unlock,
          backgroundApi,
          connectId: 'test-connect',
          isCurrent: () => true,
        }),
      ).rejects.toMatchObject({
        code: common.code,
        key: common.key,
        className: common.className,
        $isHardwareError: true,
      });
      expect(ui.deviceStageJoinBurst).toHaveBeenCalledWith({
        connectId: 'test-connect',
      });
      expect(ui.deviceStageLeaveBurst).toHaveBeenCalledWith({
        error: expect.objectContaining({
          code: common.code,
          key: common.key,
          $isHardwareError: true,
        }),
      });
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
    ).rejects.toMatchObject({
      key: ETranslations.cloud_sync_hardware_hidden_wallet__msg,
      autoToast: false,
    });
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
    ).rejects.toThrow('Couldn’t complete this action');
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

  test.each([false, null, undefined])(
    'shows a firmware path rejection with attach-PIN status %s',
    async (unlockedAttachPin) => {
      const { backgroundApi, sdk } = buildBackgroundApi({
        unlocked: true,
        unlockedAttachPin,
        passphraseProtection: false,
      });
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
      ).rejects.toThrow('Forbidden key path');
      expect(sdk.btcSignMessage).not.toHaveBeenCalled();
    },
  );

  test('keeps the shared hardware error for transport failures', async () => {
    const { backgroundApi, sdk } = buildBackgroundApi();
    const payload = {
      code: HardwareErrorCode.DeviceNotFound,
      error: 'Device not found',
    };
    sdk.openWalletSession.mockResolvedValueOnce({ success: false, payload });
    await expect(
      generateHardwareCloudSyncCredentialWithSdk({
        unlock,
        backgroundApi,
        connectId: 'test-connect',
        isCurrent: () => true,
      }),
    ).rejects.toMatchObject(convertDeviceError(payload));
  });

  test('preserves errors thrown during signing', async () => {
    const { backgroundApi, sdk } = buildBackgroundApi();
    const error = convertDeviceError({
      code: HardwareErrorCode.ActionCancelled,
      error: 'Action cancelled',
    });
    sdk.btcSignMessage.mockRejectedValue(error);
    await expect(
      generateHardwareCloudSyncCredentialWithSdk({
        unlock,
        backgroundApi,
        connectId: 'test-connect',
        isCurrent: () => true,
      }),
    ).rejects.toMatchObject({
      key: error.key,
      code: error.code,
      message: error.message,
      className: error.className,
    });
  });

  test.each([
    [
      HardwareErrorCode.ActionCancelled,
      ETranslations.hardware_user_cancel_error,
    ],
    [
      HardwareErrorCode.CallQueueActionCancelled,
      ETranslations.hardware_user_cancel_error,
    ],
    [
      HardwareErrorCode.PinCancelled,
      ETranslations.feedback_pin_verification_cancelled,
    ],
  ] as const)(
    'preserves the cancellation message for SDK code %s',
    async (code, key) => {
      const { backgroundApi, sdk } = buildBackgroundApi();
      sdk.openWalletSession.mockResolvedValueOnce({
        success: false,
        payload: { code, error: 'synthetic-private-device-detail' },
      });
      const operation = generateHardwareCloudSyncCredentialWithSdk({
        unlock,
        backgroundApi,
        connectId: 'test-connect',
        isCurrent: () => true,
      });
      await expect(operation).rejects.toMatchObject({ key });
      await expect(operation).rejects.toHaveProperty('payload.code', code);
      expect(sdk.btcSignMessage).not.toHaveBeenCalled();
    },
  );

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
    ).rejects.toThrow('Operation canceled');
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
    ).rejects.toThrow('Operation canceled');
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
      ).rejects.toMatchObject({
        key: ETranslations.cloud_sync_hardware_unavailable__msg,
      });
      expect(sdk.openWalletSession).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(platformEnv, 'isDesktop', {
        value: originalDesktop,
        configurable: true,
      });
    }
  });

  test('extension generation uses the protected standard-wallet session', async () => {
    const { backgroundApi, sdk, hardware } = buildBackgroundApi();
    const extension = jest.replaceProperty(platformEnv, 'isExtension', true);
    const desktop = jest.replaceProperty(platformEnv, 'isDesktop', false);
    try {
      await expect(
        generateHardwareCloudSyncCredentialWithSdk({
          unlock,
          backgroundApi,
          connectId: 'test-connect',
          isCurrent: () => true,
        }),
      ).resolves.toEqual(
        expect.objectContaining({ credential: expect.any(Object) }),
      );
      expect(sdk.openWalletSession).toHaveBeenCalledWith('test-connect', {
        mode: 'standard',
      });
      expect(hardware.runWithSensitiveCloudKeyOperation).toHaveBeenCalled();
    } finally {
      extension.restore();
      desktop.restore();
    }
  });

  test('signs in on P_auth before the KEK, in one device session', async () => {
    const { backgroundApi, sdk, ui } = buildBackgroundApi();
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
        expect(await device.signAuth(authMessage, authContext)).toBe(
          Buffer.from('aa'.repeat(65), 'hex').toString('base64'),
        );
        await device.deriveKek(TEST_SALT);
        return { ...mockCredential, keylessWalletId: device.credentialId };
      },
      backgroundApi,
      connectId: 'test-connect',
      isCurrent: () => true,
      // Progress is announced before each confirmation the device asks for.
      onDeviceSign: () => order.push('confirm'),
    });
    expect(order).toEqual([
      'confirm',
      HARDWARE_CLOUD_SYNC_AUTH_PATH,
      'confirm',
      HARDWARE_CLOUD_SYNC_PATH,
    ]);
    expect(ui.runExclusiveOneKeyOperation).toHaveBeenCalledTimes(1);
    expect(sdk.btcSignMessage).toHaveBeenNthCalledWith(
      1,
      'test-connect',
      'test-device',
      {
        path: HARDWARE_CLOUD_SYNC_AUTH_PATH,
        coin: 'Bitcoin',
        useEmptyPassphrase: true,
        messageHex: Buffer.from(authMessage, 'utf8').toString('hex'),
      },
    );
  });

  test('refuses to sign a challenge that is not a sign-in message', async () => {
    const { backgroundApi, sdk } = buildBackgroundApi();
    await expect(
      generateHardwareCloudSyncCredentialWithSdk({
        unlock: async (device) => {
          await device.signAuth('Sign anything', authContext);
          return mockCredential;
        },
        backgroundApi,
        connectId: 'test-connect',
        isCurrent: () => true,
      }),
    ).rejects.toMatchObject({
      key: ETranslations.cloud_sync_data_unreadable__msg,
    });
    expect(sdk.btcSignMessage).not.toHaveBeenCalled();
  });

  test.each(['before', 'during'] as const)(
    'rejects a full wallet identity change %s auth signing',
    async (phase) => {
      const { backgroundApi, sdk, hardware } = buildBackgroundApi();
      const switchWallet = () =>
        hardware.buildHwWalletXfp.mockResolvedValue(
          `00001234--xpub${'B'.repeat(107)}`,
        );
      sdk.btcSignMessage.mockImplementation(async () => {
        switchWallet();
        return {
          success: true,
          payload: { signature: 'aa'.repeat(65), address: 'test-address' },
        };
      });
      await expect(
        generateHardwareCloudSyncCredentialWithSdk({
          unlock: async (device) => {
            if (phase === 'before') switchWallet();
            await device.signAuth(authMessage, authContext);
            return mockCredential;
          },
          backgroundApi,
          connectId: 'test-connect',
          isCurrent: () => true,
        }),
      ).rejects.toMatchObject({
        key: ETranslations.cloud_sync_hardware_unlock_failed__msg,
      });
      expect(sdk.btcSignMessage).toHaveBeenCalledTimes(
        phase === 'before' ? 0 : 1,
      );
      expect(deriveHardwareCloudSyncKek).not.toHaveBeenCalled();
    },
  );

  test.each(['before', 'during'] as const)(
    'rejects a device change %s auth signing',
    async (phase) => {
      const { backgroundApi, sdk, hardware } = buildBackgroundApi();
      const switchDevice = () =>
        hardware.getDeviceState.mockResolvedValue({
          identity: {
            deviceId: 'replacement-device',
            label: 'Other',
            deviceType: 'pro',
          },
          status: { unlocked: true, unlockedAttachPin: false },
        });
      sdk.btcSignMessage.mockImplementation(async () => {
        switchDevice();
        return {
          success: true,
          payload: { signature: 'aa'.repeat(65), address: 'test-address' },
        };
      });
      await expect(
        generateHardwareCloudSyncCredentialWithSdk({
          unlock: async (device) => {
            if (phase === 'before') switchDevice();
            await device.signAuth(authMessage, authContext);
            return mockCredential;
          },
          backgroundApi,
          connectId: 'test-connect',
          isCurrent: () => true,
        }),
      ).rejects.toMatchObject({
        key: ETranslations.cloud_sync_hardware_unlock_failed__msg,
      });
      expect(sdk.btcSignMessage).toHaveBeenCalledTimes(
        phase === 'before' ? 0 : 1,
      );
    },
  );

  test.each(['identity read', 'device confirmation'] as const)(
    'rejects a challenge expiring during %s',
    async (phase) => {
      const { backgroundApi, sdk, hardware } = buildBackgroundApi();
      const expire = () =>
        jest
          .spyOn(systemTimeUtils, 'getEstimatedServerTime')
          .mockReturnValue(AUTH_NOW + 5 * 60 * 1000);
      if (phase === 'identity read') {
        hardware.buildHwWalletXfp
          .mockResolvedValueOnce(walletXfp)
          .mockImplementation(async () => {
            expire();
            return walletXfp;
          });
      } else {
        sdk.btcSignMessage.mockImplementation(async () => {
          expire();
          return {
            success: true,
            payload: { signature: 'aa'.repeat(65), address: 'test-address' },
          };
        });
      }
      await expect(
        generateHardwareCloudSyncCredentialWithSdk({
          unlock: async (device) => {
            await device.signAuth(authMessage, authContext);
            return mockCredential;
          },
          backgroundApi,
          connectId: 'test-connect',
          isCurrent: () => true,
        }),
      ).rejects.toMatchObject({
        key: ETranslations.cloud_sync_data_unreadable__msg,
        reason:
          'Invalid Cloud sync sign-in challenge: local context or expiry mismatch',
      });
      expect(sdk.btcSignMessage).toHaveBeenCalledTimes(
        phase === 'identity read' ? 0 : 1,
      );
    },
  );

  test.each([
    { ...authContext, identityTag: 'fedcba9876543210' },
    { ...authContext, env: 'test' as const },
    { ...authContext, jkt: `${authContext.jkt.slice(0, 8)}${'a'.repeat(35)}` },
  ])(
    'rejects mismatched local auth context %j before SDK signing',
    async (expected) => {
      const { backgroundApi, sdk } = buildBackgroundApi();
      await expect(
        generateHardwareCloudSyncCredentialWithSdk({
          unlock: async (device) => {
            await device.signAuth(authMessage, expected);
            return mockCredential;
          },
          backgroundApi,
          connectId: 'test-connect',
          isCurrent: () => true,
        }),
      ).rejects.toMatchObject({
        key:
          expected.identityTag === authContext.identityTag
            ? ETranslations.cloud_sync_data_unreadable__msg
            : ETranslations.cloud_sync_hardware_unlock_failed__msg,
      });
      expect(sdk.btcSignMessage).not.toHaveBeenCalled();
    },
  );

  test("passes the caller's own errors through unchanged", async () => {
    const { backgroundApi } = buildBackgroundApi();
    const serverError = new Error('Encryption key changed. Sync again.');
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
