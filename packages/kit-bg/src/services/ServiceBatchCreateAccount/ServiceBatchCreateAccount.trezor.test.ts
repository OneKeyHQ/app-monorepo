import { HardwareErrorCode } from '@onekeyfe/hwk-adapter-core';

import {
  THIRD_PARTY_HW_INTERACTION_ENDED_CODE,
  THIRD_PARTY_HW_INTERACTION_NOT_FOUND_CODE,
} from '@onekeyhq/shared/src/errors/errors/thirdPartyHardwareErrors';
import { LEDGER_CONFIG } from '@onekeyhq/shared/src/hardware/config/ledger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import ServiceBatchCreateAccount, {
  bindThirdPartyAllNetworkGetAddress,
  getLedgerAllNetworkDeviceIdentity,
} from './ServiceBatchCreateAccount';

import type { IDBDevice } from '../../dbs/local/types';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
  backgroundMethodForDev:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
  toastIfError:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    hardware: {
      sdkLog: {
        consoleLog: jest.fn(),
        log: jest.fn(),
      },
    },
    account: {
      batchCreatePerf: new Proxy(
        {},
        {
          get: () => jest.fn(),
        },
      ),
    },
  },
}));

jest.mock('../../dbs/local/localDb', () => ({
  __esModule: true,
  default: {},
}));

describe('ServiceBatchCreateAccount third-party all-network', () => {
  const ledgerConfig = LEDGER_CONFIG;
  const originalIsDesktop = platformEnv.isDesktop;
  const originalIsSupportDesktopBle = platformEnv.isSupportDesktopBle;

  afterEach(() => {
    jest.restoreAllMocks();
    (platformEnv as { isDesktop: boolean | undefined }).isDesktop =
      originalIsDesktop;
    (
      platformEnv as { isSupportDesktopBle: boolean | undefined }
    ).isSupportDesktopBle = originalIsSupportDesktopBle;
  });

  it.each([
    THIRD_PARTY_HW_INTERACTION_NOT_FOUND_CODE,
    THIRD_PARTY_HW_INTERACTION_ENDED_CODE,
  ])('aborts a hardware batch when interaction %s is lost', (code) => {
    const service = new ServiceBatchCreateAccount({ backgroundApi: {} });
    const error = Object.assign(new Error('interaction lost'), { code });

    expect(() =>
      service.forceExitFlowWhenErrorMatched({
        walletId: 'hw-test-wallet',
        error,
        saveToDb: true,
        autoHandleExitError: true,
      }),
    ).toThrow(error);
  });

  it('reads Ledger chain fingerprint from deviceIdentity before legacy fields', () => {
    expect(
      getLedgerAllNetworkDeviceIdentity({
        deviceIdentity: {
          vendor: 'ledger',
          type: 'chainFingerprint',
          chain: 'evm',
          value: 'new-fingerprint',
        },
        chainFingerprint: 'legacy-fingerprint',
        chainFingerprintChain: 'evm',
      }),
    ).toEqual({
      chain: 'evm',
      fingerprint: 'new-fingerprint',
    });
  });

  it('does not treat Trezor deviceIdentity as a Ledger chain fingerprint', () => {
    expect(
      getLedgerAllNetworkDeviceIdentity({
        deviceIdentity: {
          vendor: 'trezor',
          type: 'deviceId',
          value: 'trezor-device-id',
        },
      }),
    ).toBeUndefined();
  });

  it('binds third-party all-network get-address to preserve SDK adapter this context', async () => {
    const thirdPartyHw = {
      deviceId: 'FEATURES_DEVICE_ID',
      async allNetworkGetAddress(connectId: string) {
        return {
          success: false as const,
          payload: {
            code: HardwareErrorCode.DeviceNotFound,
            error: this.deviceId,
            errorCode: HardwareErrorCode.DeviceNotFound,
            connectId,
            deviceId: this.deviceId,
          },
        };
      },
    };

    const allNetworkGetAddress =
      bindThirdPartyAllNetworkGetAddress(thirdPartyHw);

    await expect(
      allNetworkGetAddress?.('USB_CONNECT_ID', 'FEATURES_DEVICE_ID', {
        bundle: [],
      }),
    ).resolves.toMatchObject({
      success: false,
      payload: {
        connectId: 'USB_CONNECT_ID',
        deviceId: 'FEATURES_DEVICE_ID',
        error: 'FEATURES_DEVICE_ID',
      },
    });
  });

  it('delegates all-network transport resolution to a single SDK call', async () => {
    (platformEnv as { isDesktop: boolean }).isDesktop = true;
    (platformEnv as { isSupportDesktopBle: boolean }).isSupportDesktopBle =
      true;
    const dbDevice = {
      id: 'db-device-1',
      connectId: 'USB_CONNECT_ID',
      usbConnectId: 'USB_CONNECT_ID',
      deviceId: 'FEATURES_DEVICE_ID',
      vendor: EHardwareVendor.trezor,
      settingsRaw: JSON.stringify({
        vendor: 'trezor',
        vendorModel: 'T3W1',
        vendorModelName: 'Safe 7',
      }),
    } as IDBDevice;
    const allNetworkGetAddress = jest.fn().mockResolvedValueOnce({
      success: true,
      payload: [
        {
          success: true,
          network: 'evm',
          path: "m/44'/60'/0'/0/0",
          payload: {
            address: '0x1234',
          },
        },
      ],
    });
    const service = new ServiceBatchCreateAccount({
      backgroundApi: {
        serviceThirdPartyHardware: {},
      },
    });

    const result = await (
      service as unknown as {
        callThirdPartyAllNetworkGetAddress: (
          params: unknown,
        ) => Promise<unknown>;
      }
    ).callThirdPartyAllNetworkGetAddress({
      allNetworkGetAddress,
      connectId: dbDevice.connectId,
      deviceId: dbDevice.deviceId,
      dbDeviceId: dbDevice.id,
      dbDevice,
      vendor: EHardwareVendor.trezor,
      createSceneParams: {},
      bundleParams: [
        {
          network: 'evm',
          path: "m/44'/60'/0'/0/0",
          showOnOneKey: false,
        },
      ],
      vendorName: 'Trezor',
    });

    expect(result).toEqual([
      {
        success: true,
        network: 'evm',
        path: "m/44'/60'/0'/0/0",
        payload: {
          address: '0x1234',
        },
      },
    ]);
    expect(allNetworkGetAddress).toHaveBeenCalledTimes(1);
    expect(allNetworkGetAddress.mock.calls[0][0]).toBe('USB_CONNECT_ID');
    expect(allNetworkGetAddress.mock.calls[0][1]).toBe(dbDevice.deviceId);
  });

  it('uses an interaction id directly and never enters transport fallback', async () => {
    const dbDevice = {
      id: 'db-device-1',
      connectId: 'USB_CONNECT_ID',
      deviceId: 'FEATURES_DEVICE_ID',
      vendor: EHardwareVendor.trezor,
    } as IDBDevice;
    const allNetworkGetAddress = jest.fn().mockResolvedValue({
      success: true,
      payload: [],
    });
    const service = new ServiceBatchCreateAccount({
      backgroundApi: {
        serviceThirdPartyHardware: {},
      },
    });

    await (
      service as unknown as {
        callThirdPartyAllNetworkGetAddress: (
          params: unknown,
        ) => Promise<unknown>;
      }
    ).callThirdPartyAllNetworkGetAddress({
      allNetworkGetAddress,
      connectId: dbDevice.connectId,
      deviceId: dbDevice.deviceId,
      dbDevice,
      vendor: EHardwareVendor.trezor,
      commonParams: {
        passphraseState: undefined,
        useEmptyPassphrase: true,
        interactionId: 'hwk-trezor-interaction',
      },
      createSceneParams: {},
      bundleParams: [],
      vendorName: 'Trezor',
    });

    expect(allNetworkGetAddress).toHaveBeenCalledTimes(1);
    expect(allNetworkGetAddress).toHaveBeenCalledWith(
      'hwk-trezor-interaction',
      'FEATURES_DEVICE_ID',
      expect.objectContaining({
        interactionId: 'hwk-trezor-interaction',
      }),
    );
  });

  it.each([false, true])(
    'defaults to adding a missing Ledger chain without querying another app (hasOtherFingerprint=%s)',
    async (hasOtherFingerprint) => {
      expect(ledgerConfig.enableCrossChainFingerprintVerification).toBe(false);
      const getAdapterForVendor = jest.fn();
      const allNetworkGetAddress = jest.fn().mockResolvedValue({
        success: true,
        payload: [],
      });
      const service = new ServiceBatchCreateAccount({
        backgroundApi: { serviceThirdPartyHardware: { getAdapterForVendor } },
      });
      await (
        service as unknown as {
          callThirdPartyAllNetworkGetAddress: (
            params: unknown,
          ) => Promise<unknown>;
        }
      ).callThirdPartyAllNetworkGetAddress({
        allNetworkGetAddress,
        connectId: 'stored-ledger-target',
        deviceId: '',
        dbDevice: {
          id: `default-ledger-batch-${hasOtherFingerprint}`,
          connectId: 'stored-ledger-target',
          deviceId: '',
          vendor: EHardwareVendor.ledger,
          settingsRaw: JSON.stringify({
            chainFingerprints: hasOtherFingerprint ? { evm: 'stored-evm' } : {},
          }),
        } as IDBDevice,
        vendor: EHardwareVendor.ledger,
        commonParams: {},
        createSceneParams: {},
        bundleParams: [
          { network: 'btc', path: "m/84'/0'/0'", showOnOneKey: false },
        ],
        vendorName: 'Ledger',
      });
      expect(allNetworkGetAddress).toHaveBeenCalledWith(
        'stored-ledger-target',
        '',
        expect.objectContaining({
          bundle: [expect.objectContaining({ network: 'btc' })],
        }),
      );
      expect(getAdapterForVendor).not.toHaveBeenCalled();
    },
  );

  it('does not call Ledger all-network for an existing wallet with no trusted identity', async () => {
    jest.replaceProperty(
      ledgerConfig,
      'enableCrossChainFingerprintVerification',
      true,
    );
    const dbDevice = {
      id: 'ledger-db-device',
      connectId: '',
      deviceId: '',
      vendor: EHardwareVendor.ledger,
      settingsRaw: '{}',
    } as IDBDevice;
    const allNetworkGetAddress = jest.fn();
    const service = new ServiceBatchCreateAccount({
      backgroundApi: {
        serviceThirdPartyHardware: {
          getAdapterForVendor: jest.fn(),
        },
      },
    });

    await expect(
      (
        service as unknown as {
          callThirdPartyAllNetworkGetAddress: (
            params: unknown,
          ) => Promise<unknown>;
        }
      ).callThirdPartyAllNetworkGetAddress({
        allNetworkGetAddress,
        connectId: dbDevice.connectId,
        deviceId: dbDevice.deviceId,
        dbDevice,
        vendor: EHardwareVendor.ledger,
        commonParams: {},
        createSceneParams: {},
        bundleParams: [
          {
            network: 'evm',
            path: "m/44'/60'/0'/0/0",
            showOnOneKey: false,
          },
        ],
        vendorName: 'Ledger',
      }),
    ).rejects.toBeDefined();
    expect(allNetworkGetAddress).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'pins Ledger cross-chain batch verification and releases it (mismatch=%s)',
    async (mismatch) => {
      jest.replaceProperty(
        ledgerConfig,
        'enableCrossChainFingerprintVerification',
        true,
      );
      const interactionId = 'hwk-ledger-batch-verification';
      const connectDevice = jest
        .fn()
        .mockResolvedValue({ success: true, payload: { interactionId } });
      const releaseInteraction = jest.fn().mockResolvedValue(undefined);
      const getChainFingerprint = jest.fn().mockResolvedValue({
        success: true,
        payload: mismatch ? 'wrong-evm' : 'stored-evm',
      });
      const allNetworkGetAddress = jest
        .fn()
        .mockResolvedValue({ success: true, payload: [] });
      const service = new ServiceBatchCreateAccount({
        backgroundApi: {
          serviceThirdPartyHardware: {
            getAdapterForVendor: jest.fn().mockResolvedValue({
              connectDevice,
              releaseInteraction,
              hw: { getChainFingerprint },
            }),
          },
        },
      });
      const operation = (
        service as unknown as {
          callThirdPartyAllNetworkGetAddress: (
            params: unknown,
          ) => Promise<unknown>;
        }
      ).callThirdPartyAllNetworkGetAddress({
        allNetworkGetAddress,
        connectId: '',
        deviceId: '',
        dbDevice: {
          id: `ledger-batch-${mismatch}`,
          connectId: '',
          deviceId: '',
          vendor: EHardwareVendor.ledger,
          settingsRaw: JSON.stringify({
            chainFingerprints: { evm: 'stored-evm' },
          }),
        } as IDBDevice,
        vendor: EHardwareVendor.ledger,
        commonParams: {},
        createSceneParams: {},
        bundleParams: [
          { network: 'sol', path: "m/44'/501'/0'/0'", showOnOneKey: false },
        ],
        vendorName: 'Ledger',
      });
      if (mismatch) {
        await expect(operation).rejects.toBeDefined();
        expect(allNetworkGetAddress).not.toHaveBeenCalled();
      } else {
        await operation;
        expect(allNetworkGetAddress).toHaveBeenCalledWith(
          interactionId,
          '',
          expect.objectContaining({ interactionId }),
        );
      }
      expect(connectDevice).toHaveBeenCalledWith(
        '',
        expect.objectContaining({
          knownConnections: [],
          extra: { dbDeviceId: `ledger-batch-${mismatch}` },
        }),
      );
      expect(getChainFingerprint).toHaveBeenCalledWith(
        interactionId,
        'stored-evm',
        'evm',
      );
      expect(releaseInteraction).toHaveBeenCalledWith(interactionId);
    },
  );

  it('allows a new Ledger wallet to establish its first all-network identity', async () => {
    const dbDevice = {
      id: 'new-ledger-db-device',
      connectId: '',
      deviceId: '',
      vendor: EHardwareVendor.ledger,
      settingsRaw: '{}',
    } as IDBDevice;
    const allNetworkGetAddress = jest.fn().mockResolvedValue({
      success: true,
      payload: [],
    });
    const service = new ServiceBatchCreateAccount({ backgroundApi: {} });

    await (
      service as unknown as {
        callThirdPartyAllNetworkGetAddress: (
          params: unknown,
        ) => Promise<unknown>;
      }
    ).callThirdPartyAllNetworkGetAddress({
      allNetworkGetAddress,
      connectId: dbDevice.connectId,
      deviceId: dbDevice.deviceId,
      dbDevice,
      vendor: EHardwareVendor.ledger,
      commonParams: {
        interactionId: 'hwk-ledger-onboarding',
        allowDeviceIdentityBootstrap: true,
      },
      createSceneParams: {},
      bundleParams: [
        {
          network: 'evm',
          path: "m/44'/60'/0'/0/0",
          showOnOneKey: false,
        },
      ],
      vendorName: 'Ledger',
    });

    expect(allNetworkGetAddress).toHaveBeenCalledWith(
      'hwk-ledger-onboarding',
      '',
      expect.not.objectContaining({
        allowDeviceIdentityBootstrap: expect.anything(),
      }),
    );
  });
});
