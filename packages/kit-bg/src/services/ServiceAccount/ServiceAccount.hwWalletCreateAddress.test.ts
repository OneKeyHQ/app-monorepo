import { EHardwareTransportType } from '@onekeyhq/shared/types';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import localDb from '../../dbs/local/localDb';

import ServiceAccount from './ServiceAccount';

import type { IDBDevice } from '../../dbs/local/types';

jest.mock('../../states/jotai/atoms/desktopBluetooth', () => ({
  hardwareForceTransportAtom: {
    get: jest.fn().mockResolvedValue({ forceTransportType: undefined }),
  },
}));

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

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    AccountUpdate: 'AccountUpdate',
    WalletUpdate: 'WalletUpdate',
  },
  appEventBus: {
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
  },
}));

jest.mock('../../dbs/local/localDb', () => ({
  __esModule: true,
  default: {
    createHwWallet: jest.fn(),
    getDeviceByQuery: jest.fn(),
  },
}));

type IHwWalletCreateAddressService = {
  createHWWallet(params: unknown): Promise<unknown>;
  createHWWalletBase(params: unknown): Promise<{ wallet: { name: string } }>;
  setWalletNameAndAvatar(params: unknown): Promise<{ name: string }>;
  getWallet(params: unknown): Promise<{ name: string }>;
  getFeaturesForHwWalletCreate(params: {
    dbDevice: {
      vendor: EHardwareVendor;
      connectProtocol?: 'V1' | 'V2';
      deviceStateInfo?: unknown;
      deviceId?: string;
    };
    compatibleConnectId: string;
    hardwareOperationContext?: { operationId: string };
  }): Promise<{
    protocol?: string;
    deviceId?: string;
  }>;
  getFirstEvmAddressForHwWalletCreate(params: {
    compatibleConnectId: string;
    deviceId: string;
    passphraseState?: string;
    vendor?: EHardwareVendor;
    isMockedStandardHwWallet?: boolean;
  }): Promise<string | null>;
};

describe('ServiceAccount hardware wallet creation address', () => {
  const createHwWalletMock = jest.spyOn(localDb, 'createHwWallet');
  const getDeviceByQueryMock = jest.spyOn(localDb, 'getDeviceByQuery');

  beforeEach(() => {
    createHwWalletMock.mockReset();
    getDeviceByQueryMock.mockReset();
  });

  it.each([
    'connected',
    'ended',
    'wrong-device',
    'automatic',
    'automatic-saved',
  ] as const)(
    'keeps the caller-owned operation while reading device features (%s)',
    async (scenario) => {
      const automatic = scenario.startsWith('automatic');
      if (scenario === 'automatic-saved') {
        getDeviceByQueryMock.mockResolvedValue({
          id: 'device-record',
          vendor: EHardwareVendor.trezor,
          usbConnectId: 'saved-usb',
          bleConnectId: 'saved-ble',
        } as IDBDevice);
      }
      const getFeatures = jest.fn().mockResolvedValue(
        scenario === 'ended'
          ? {
              success: false,
              payload: { code: 10_113, error: 'Operation ended' },
            }
          : {
              success: true,
              payload: {
                device_id:
                  scenario === 'wrong-device'
                    ? 'other-device'
                    : 'selected-device',
              },
            },
      );
      const connectDevice = jest.fn();
      const releaseOperation = jest.fn();
      const service = new ServiceAccount({
        backgroundApi: {
          serviceThirdPartyHardware: {
            getAdapterForVendor: jest
              .fn()
              .mockResolvedValue({ hw: { getFeatures } }),
            connectDevice,
            releaseOperation,
          },
        },
      }) as unknown as IHwWalletCreateAddressService;
      const reading = service.getFeaturesForHwWalletCreate({
        dbDevice: {
          vendor: EHardwareVendor.trezor,
          deviceId: 'selected-device',
        },
        compatibleConnectId: 'other-channel-hint',
        hardwareOperationContext: automatic
          ? undefined
          : { operationId: 'caller-operation' },
      });
      if (scenario === 'connected' || automatic) {
        await expect(reading).resolves.toEqual({
          device_id: 'selected-device',
        });
      } else {
        await expect(reading).rejects.toThrow();
      }
      expect(getFeatures).toHaveBeenCalledWith(
        automatic ? 'other-channel-hint' : 'caller-operation',
        expect.objectContaining({
          expectedDeviceIdentity: {
            vendor: EHardwareVendor.trezor,
            type: 'deviceId',
            value: 'selected-device',
          },
        }),
      );
      expect(getFeatures.mock.calls[0][1]).toEqual(
        automatic
          ? {
              ...(scenario === 'automatic-saved'
                ? {
                    knownConnections: [
                      { transport: 'usb', connectId: 'saved-usb' },
                      { transport: 'ble', connectId: 'saved-ble' },
                    ],
                    extra: { dbDeviceId: 'device-record' },
                  }
                : { knownConnections: [] }),
              expectedDeviceIdentity: {
                vendor: EHardwareVendor.trezor,
                type: 'deviceId',
                value: 'selected-device',
              },
            }
          : {
              operationId: 'caller-operation',
              expectedDeviceIdentity: {
                vendor: EHardwareVendor.trezor,
                type: 'deviceId',
                value: 'selected-device',
              },
            },
      );
      expect(getDeviceByQueryMock).toHaveBeenCalledTimes(automatic ? 1 : 0);
      expect(connectDevice).not.toHaveBeenCalled();
      expect(releaseOperation).not.toHaveBeenCalled();
    },
  );

  it.each([
    EHardwareVendor.keystone,
    EHardwareVendor.ledger,
    EHardwareVendor.trezor,
  ])(
    'passes fresh %s vendor metadata to the processing wrapper',
    async (vendor) => {
      const withHardwareProcessing = jest.fn().mockResolvedValue(undefined);
      const service = new ServiceAccount({
        backgroundApi: {
          serviceSetting: {
            getHardwareTransportType: jest
              .fn()
              .mockResolvedValue(EHardwareTransportType.WEBUSB),
          },
          serviceHardwareUI: { withHardwareProcessing },
        },
      }) as unknown as IHwWalletCreateAddressService;
      await service.createHWWallet({
        device: { connectId: 'fresh-target', deviceId: '' },
        features: {},
        vendor,
      });
      expect(withHardwareProcessing).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          deviceParams: expect.objectContaining({
            dbDevice: expect.objectContaining({
              vendor,
              connectId: 'fresh-target',
            }),
          }),
        }),
      );
    },
  );

  it('persists the current Pro2 label after reading the stored wallet name', async () => {
    createHwWalletMock.mockResolvedValue({
      wallet: { id: 'hw-wallet-1', name: 'Previous device name' },
    } as never);
    const service = new ServiceAccount({
      backgroundApi: {
        serviceHardware: {
          getCompatibleConnectId: jest.fn().mockResolvedValue('PRO2_USB'),
        },
      },
    }) as unknown as IHwWalletCreateAddressService;
    const setWalletNameAndAvatarMock = jest.fn().mockResolvedValue({
      id: 'hw-wallet-1',
      name: 'Current device name',
    });
    service.setWalletNameAndAvatar = setWalletNameAndAvatarMock;

    await expect(
      service.createHWWalletBase({
        device: { connectId: 'PRO2_USB', deviceId: 'PRO2_DEVICE_ID' },
        features: { deviceId: 'PRO2_DEVICE_ID' },
        deviceState: {
          protocol: 'V2',
          identity: {
            deviceId: 'PRO2_DEVICE_ID',
            label: 'Current device name',
          },
        },
        isMockedStandardHwWallet: true,
      }),
    ).resolves.toMatchObject({ wallet: { name: 'Current device name' } });
    expect(setWalletNameAndAvatarMock).toHaveBeenCalledWith({
      walletId: 'hw-wallet-1',
      name: 'Current device name',
      shouldCheckDuplicate: false,
    });
  });

  it('keeps wallet creation successful when Pro2 label persistence fails', async () => {
    createHwWalletMock.mockResolvedValue({
      wallet: { id: 'hw-wallet-1', name: 'Previous device name' },
    } as never);
    const service = new ServiceAccount({
      backgroundApi: {
        serviceHardware: {
          getCompatibleConnectId: jest.fn().mockResolvedValue('PRO2_USB'),
        },
      },
    }) as unknown as IHwWalletCreateAddressService;
    service.setWalletNameAndAvatar = jest
      .fn()
      .mockRejectedValue(new Error('sync failed'));
    const getWalletMock = jest.fn().mockResolvedValue({
      id: 'hw-wallet-1',
      name: 'Previous device name',
    });
    service.getWallet = getWalletMock;

    await expect(
      service.createHWWalletBase({
        device: { connectId: 'PRO2_USB', deviceId: 'PRO2_DEVICE_ID' },
        features: { deviceId: 'PRO2_DEVICE_ID' },
        deviceState: {
          protocol: 'V2',
          identity: {
            deviceId: 'PRO2_DEVICE_ID',
            label: 'Current device name',
          },
        },
        isMockedStandardHwWallet: true,
      }),
    ).resolves.toMatchObject({ wallet: { name: 'Previous device name' } });
    expect(getWalletMock).toHaveBeenCalledWith({
      walletId: 'hw-wallet-1',
    });
  });

  it('keeps a serialless Trezor USB locator inside the pinned interaction', async () => {
    createHwWalletMock.mockResolvedValue({
      wallet: { id: 'hw-trezor-1', name: 'Trezor' },
    } as never);
    const getCompatibleConnectId = jest.fn().mockResolvedValue('wrong-device');
    const service = new ServiceAccount({
      backgroundApi: {
        serviceHardware: {
          getCompatibleConnectId,
        },
      },
    }) as unknown as IHwWalletCreateAddressService;
    service.setWalletNameAndAvatar = jest.fn().mockResolvedValue({
      id: 'hw-trezor-1',
      name: 'Trezor',
    });
    service.getWallet = jest.fn().mockResolvedValue({
      id: 'hw-trezor-1',
      name: 'Trezor',
    });

    await service.createHWWalletBase({
      device: {
        connectId: '0',
        deviceId: 'stable-trezor-device-id',
        name: 'Trezor',
        raw: {
          connectionType: 'usb',
          capabilities: { persistentDeviceIdentity: false },
        },
      },
      features: { device_id: 'stable-trezor-device-id' },
      isMockedStandardHwWallet: true,
      transportType: EHardwareTransportType.WEBUSB,
      vendor: EHardwareVendor.trezor,
      hardwareOperationContext: { operationId: 'interaction-id' },
    });

    expect(getCompatibleConnectId).not.toHaveBeenCalled();
    expect(createHwWalletMock).toHaveBeenCalledWith(
      expect.objectContaining({
        device: expect.objectContaining({ connectId: '0' }),
      }),
    );
  });

  it('创建 Pro1 隐藏钱包时复用已持久化状态，避免打断刚建立的 passphrase 会话', async () => {
    const getDeviceState = jest.fn();
    const service = new ServiceAccount({
      backgroundApi: {
        serviceHardware: {
          getDeviceState,
        },
      },
    }) as unknown as IHwWalletCreateAddressService;
    const deviceStateInfo = {
      schemaVersion: 1,
      revision: 1,
      updatedAt: 1,
      protocol: 'V1',
      identity: {
        deviceId: 'PRO1_DEVICE_ID',
        serialNo: 'PRO1_SERIAL',
      },
      status: {
        mode: 'normal',
        unlocked: true,
        passphraseProtection: true,
      },
      settings: {},
      versions: {
        firmware: '4.15.0',
      },
    };

    await expect(
      service.getFeaturesForHwWalletCreate({
        dbDevice: {
          vendor: EHardwareVendor.onekey,
          connectProtocol: 'V1',
          deviceStateInfo,
        },
        compatibleConnectId: 'PRO1_USB',
      }),
    ).resolves.toMatchObject({
      protocol: 'V1',
      deviceId: 'PRO1_DEVICE_ID',
    });

    expect(getDeviceState).not.toHaveBeenCalled();
  });

  it('创建 Pro2 隐藏钱包时复用已同步的 post-unlock 状态', async () => {
    const postUnlockState = {
      schemaVersion: 1,
      revision: 2,
      updatedAt: 2,
      protocol: 'V2',
      identity: {
        deviceId: 'PRO2_DEVICE_ID',
        serialNo: 'PRO2_SERIAL',
      },
      status: {
        mode: 'normal',
        unlocked: true,
        passphraseProtection: true,
      },
      settings: {},
      versions: {
        firmware: '1.0.0',
      },
    };
    const getDeviceState = jest.fn();
    const service = new ServiceAccount({
      backgroundApi: {
        serviceHardware: {
          getDeviceState,
        },
      },
    }) as unknown as IHwWalletCreateAddressService;

    await expect(
      service.getFeaturesForHwWalletCreate({
        dbDevice: {
          vendor: EHardwareVendor.onekey,
          connectProtocol: 'V2',
          deviceStateInfo: postUnlockState,
        },
        compatibleConnectId: 'PRO2_USB',
      }),
    ).resolves.toMatchObject({
      protocol: 'V2',
      deviceId: 'PRO2_DEVICE_ID',
    });

    expect(getDeviceState).not.toHaveBeenCalled();
  });

  it('创建 Pro2 隐藏钱包记录时不重复读取设备状态', async () => {
    createHwWalletMock.mockResolvedValue({
      wallet: { id: 'hw-hidden-wallet-1', name: 'Hidden Wallet' },
    } as never);
    const getDeviceState = jest.fn();
    const service = new ServiceAccount({
      backgroundApi: {
        serviceHardware: {
          getCompatibleConnectId: jest.fn().mockResolvedValue('PRO2_USB'),
          getDeviceState,
        },
      },
    }) as unknown as IHwWalletCreateAddressService;
    service.getWallet = jest.fn().mockResolvedValue({
      id: 'hw-hidden-wallet-1',
      name: 'Hidden Wallet',
    });
    const postUnlockState = {
      schemaVersion: 1,
      revision: 2,
      updatedAt: 2,
      protocol: 'V2',
      identity: {
        deviceId: 'PRO2_DEVICE_ID',
        serialNo: 'PRO2_SERIAL',
      },
      status: {
        mode: 'normal',
        unlocked: true,
        unlockedAttachPin: false,
        passphraseProtection: true,
      },
      settings: {},
      versions: { firmware: '1.0.0' },
    };

    await service.createHWWalletBase({
      device: {
        connectId: 'PRO2_USB',
        deviceId: 'PRO2_DEVICE_ID',
        vendor: EHardwareVendor.onekey,
      },
      features: { deviceId: 'PRO2_DEVICE_ID' },
      connectProtocol: 'V2',
      deviceState: postUnlockState,
      passphraseState: 'PRO2_HIDDEN_STATE',
      fillingXfpByCallingSdk: false,
      vendor: EHardwareVendor.onekey,
    });

    expect(getDeviceState).not.toHaveBeenCalled();
    expect(createHwWalletMock).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceState: postUnlockState,
        passphraseState: 'PRO2_HIDDEN_STATE',
      }),
    );
  });

  it('derives a OneKey hidden wallet address from its passphrase state', async () => {
    const getEvmAddressByWalletState = jest.fn().mockResolvedValue('0xhidden');
    const getEvmAddressByStandardWallet = jest
      .fn()
      .mockResolvedValue('0xstandard');
    const service = new ServiceAccount({
      backgroundApi: {
        serviceHardware: {
          getEvmAddressByWalletState,
          getEvmAddressByStandardWallet,
        },
      },
    }) as unknown as IHwWalletCreateAddressService;

    await expect(
      service.getFirstEvmAddressForHwWalletCreate({
        compatibleConnectId: 'PRO2_USB',
        deviceId: 'PRO2_DEVICE_ID',
        passphraseState: 'PRO2_HIDDEN_STATE',
        vendor: EHardwareVendor.onekey,
      }),
    ).resolves.toBe('0xhidden');

    expect(getEvmAddressByWalletState).toHaveBeenCalledWith({
      connectId: 'PRO2_USB',
      deviceId: 'PRO2_DEVICE_ID',
      path: "m/44'/60'/0'/0/0",
      vendor: EHardwareVendor.onekey,
      passphraseState: 'PRO2_HIDDEN_STATE',
      useEmptyPassphrase: undefined,
    });
    expect(getEvmAddressByStandardWallet).not.toHaveBeenCalled();
  });

  it('keeps standard wallet creation on the empty passphrase', async () => {
    const getEvmAddressByWalletState = jest
      .fn()
      .mockResolvedValue('0xstandard');
    const service = new ServiceAccount({
      backgroundApi: {
        serviceHardware: {
          getEvmAddressByWalletState,
        },
      },
    }) as unknown as IHwWalletCreateAddressService;

    await expect(
      service.getFirstEvmAddressForHwWalletCreate({
        compatibleConnectId: 'PRO2_USB',
        deviceId: 'PRO2_DEVICE_ID',
        vendor: EHardwareVendor.onekey,
      }),
    ).resolves.toBe('0xstandard');

    expect(getEvmAddressByWalletState).toHaveBeenCalledWith({
      connectId: 'PRO2_USB',
      deviceId: 'PRO2_DEVICE_ID',
      path: "m/44'/60'/0'/0/0",
      vendor: EHardwareVendor.onekey,
      passphraseState: undefined,
      useEmptyPassphrase: true,
    });
  });

  it('creates a mocked standard wallet without opening its device session', async () => {
    createHwWalletMock.mockImplementation(async (params) => {
      expect(params.getFirstEvmAddressFn).toEqual(expect.any(Function));
      if (params.getFirstEvmAddressFn) {
        await expect(params.getFirstEvmAddressFn()).resolves.toBe('');
      }
      return {
        wallet: { id: 'hw-standard-mocked', name: 'Trezor' },
      } as never;
    });
    const buildHwWalletXfp = jest.fn();
    const getEvmAddressByWalletState = jest.fn();
    const service = new ServiceAccount({
      backgroundApi: {
        serviceHardware: {
          getCompatibleConnectId: jest.fn().mockResolvedValue('TREZOR_USB'),
          buildHwWalletXfp,
          getEvmAddressByWalletState,
        },
      },
    }) as unknown as IHwWalletCreateAddressService;
    service.getWallet = jest.fn().mockResolvedValue({
      id: 'hw-standard-mocked',
      name: 'Trezor',
    });

    await expect(
      service.createHWWalletBase({
        device: {
          connectId: 'TREZOR_USB',
          deviceId: 'TREZOR_DEVICE_ID',
          vendor: EHardwareVendor.trezor,
        },
        features: { deviceId: 'TREZOR_DEVICE_ID' },
        vendor: EHardwareVendor.trezor,
        fillingXfpByCallingSdk: true,
        isMockedStandardHwWallet: true,
      }),
    ).resolves.toMatchObject({ wallet: { id: 'hw-standard-mocked' } });

    expect(buildHwWalletXfp).not.toHaveBeenCalled();
    expect(getEvmAddressByWalletState).not.toHaveBeenCalled();
  });

  it('uses the runtime interaction for identity reads without persisting it', async () => {
    const getEvmAddressByWalletState = jest
      .fn()
      .mockResolvedValue('0xinteraction');
    createHwWalletMock.mockImplementation(async (params) => {
      const createParams = params as {
        getFirstEvmAddressFn: () => Promise<string | null>;
      };
      await expect(createParams.getFirstEvmAddressFn()).resolves.toBe(
        '0xinteraction',
      );
      return {
        wallet: { id: 'hw-ledger-wallet', name: 'Ledger' },
      } as never;
    });
    const service = new ServiceAccount({
      backgroundApi: {
        serviceHardware: {
          getEvmAddressByWalletState,
        },
      },
    }) as unknown as IHwWalletCreateAddressService;
    service.getWallet = jest.fn().mockResolvedValue({
      id: 'hw-ledger-wallet',
      name: 'Ledger',
    });

    await service.createHWWalletBase({
      device: {
        connectId: 'LEDGER_USB_TARGET',
        deviceId: '',
        vendor: EHardwareVendor.ledger,
      },
      features: { deviceId: '' },
      vendor: EHardwareVendor.ledger,
      hardwareOperationContext: {
        operationId: 'hwk-ledger-interaction',
      },
      fillingXfpByCallingSdk: false,
    });

    expect(getEvmAddressByWalletState).toHaveBeenCalledWith(
      expect.objectContaining({
        connectId: 'hwk-ledger-interaction',
        vendor: EHardwareVendor.ledger,
      }),
    );
    expect(createHwWalletMock).toHaveBeenCalledWith(
      expect.not.objectContaining({
        hardwareOperationContext: expect.anything(),
      }),
    );
  });

  it.each([
    undefined,
    EHardwareTransportType.WEBUSB,
    EHardwareTransportType.BLE,
  ])(
    'creates a saved Trezor wallet without a legacy locator (%s)',
    async (transportType) => {
      const device = {
        id: 'saved-trezor',
        vendor: EHardwareVendor.trezor,
        connectId: '',
        usbConnectId: 'saved-usb',
        bleConnectId: 'saved-ble',
        deviceId: 'saved-identity',
      } as IDBDevice;
      getDeviceByQueryMock.mockResolvedValue(device);
      const getFeatures = jest.fn().mockResolvedValue({
        success: true,
        payload: { device_id: device.deviceId },
      });
      const getCompatibleConnectId = jest.fn();
      createHwWalletMock.mockResolvedValue({
        wallet: { id: 'hw-saved', name: 'Trezor' },
      } as Awaited<ReturnType<typeof localDb.createHwWallet>>);
      const service = new ServiceAccount({
        backgroundApi: {
          serviceHardware: { getCompatibleConnectId },
          serviceThirdPartyHardware: {
            getAdapterForVendor: jest
              .fn()
              .mockResolvedValue({ hw: { getFeatures } }),
            persistTrezorThpCredentials: jest.fn(),
          },
        },
      }) as unknown as IHwWalletCreateAddressService;
      service.getWallet = jest
        .fn()
        .mockResolvedValue({ id: 'hw-saved', name: 'Trezor' });

      await service.createHWWalletBase({
        device,
        features: { device_id: device.deviceId },
        transportType,
      });

      expect(getCompatibleConnectId).not.toHaveBeenCalled();
      expect(getFeatures).toHaveBeenCalledWith(
        '',
        expect.objectContaining({
          knownConnections: [
            { transport: 'usb', connectId: 'saved-usb' },
            { transport: 'ble', connectId: 'saved-ble' },
          ],
          expectedDeviceIdentity: {
            vendor: 'trezor',
            type: 'deviceId',
            value: device.deviceId,
          },
        }),
      );
      expect(createHwWalletMock).toHaveBeenCalledWith(
        expect.objectContaining({
          vendor: EHardwareVendor.trezor,
          device: expect.objectContaining({
            connectId: '',
            usbConnectId: 'saved-usb',
            bleConnectId: 'saved-ble',
          }),
        }),
      );
    },
  );

  it('keeps a caller-owned operation when the saved locator is empty', async () => {
    const getFeatures = jest.fn().mockResolvedValue({
      success: true,
      payload: { device_id: 'selected-device' },
    });
    const getCompatibleConnectId = jest.fn();
    createHwWalletMock.mockResolvedValue({
      wallet: { id: 'hw-pinned', name: 'Trezor' },
    } as Awaited<ReturnType<typeof localDb.createHwWallet>>);
    const service = new ServiceAccount({
      backgroundApi: {
        serviceHardware: { getCompatibleConnectId },
        serviceThirdPartyHardware: {
          getAdapterForVendor: jest
            .fn()
            .mockResolvedValue({ hw: { getFeatures } }),
          persistTrezorThpCredentials: jest.fn(),
        },
      },
    }) as unknown as IHwWalletCreateAddressService;
    service.getWallet = jest.fn().mockResolvedValue({ name: 'Trezor' });
    await service.createHWWalletBase({
      device: {
        vendor: EHardwareVendor.trezor,
        deviceId: 'selected-device',
        connectId: '',
      },
      features: { device_id: 'selected-device' },
      hardwareOperationContext: { operationId: 'caller-operation' },
      transportType: EHardwareTransportType.BLE,
    });
    expect(getFeatures).toHaveBeenCalledWith(
      'caller-operation',
      expect.objectContaining({ operationId: 'caller-operation' }),
    );
    expect(getDeviceByQueryMock).not.toHaveBeenCalled();
    expect(getCompatibleConnectId).not.toHaveBeenCalled();
    expect(createHwWalletMock).toHaveBeenCalledWith(
      expect.not.objectContaining({
        hardwareOperationContext: expect.anything(),
      }),
    );
  });

  it('creates a Trezor hidden wallet using saved locators and identity', async () => {
    const device = {
      id: 'saved-device',
      vendor: EHardwareVendor.trezor,
      connectId: '',
      deviceId: 'saved-identity',
      usbConnectId: 'saved-usb',
      bleConnectId: 'saved-ble',
    } as IDBDevice;
    getDeviceByQueryMock.mockResolvedValue(device);
    createHwWalletMock.mockResolvedValue({
      wallet: { id: 'hw-hidden', name: 'Hidden wallet' },
    } as Awaited<ReturnType<typeof localDb.createHwWallet>>);
    const getFeatures = jest.fn().mockResolvedValue({
      success: true,
      payload: { device_id: device.deviceId },
    });
    const getTrezorPassphraseState = jest
      .fn()
      .mockResolvedValue('fixture-hidden-state');
    const getCompatibleConnectId = jest.fn();
    const service = new ServiceAccount({
      backgroundApi: {
        serviceHardware: {
          getCompatibleConnectId,
          buildHwWalletXfp: jest.fn(),
        },
        serviceHardwareUI: {
          withHardwareProcessing: async (fn: () => Promise<unknown>) => fn(),
        },
        serviceThirdPartyHardware: {
          getAdapterForVendor: jest
            .fn()
            .mockResolvedValue({ hw: { getFeatures } }),
          getTrezorPassphraseState,
          persistTrezorThpCredentials: jest.fn(),
        },
        serviceSetting: {
          getHiddenWalletImmediately: jest.fn().mockResolvedValue(false),
        },
        serviceAccountProfile: {
          isSoftwareWalletOnlyUser: jest.fn().mockResolvedValue(false),
        },
      },
    });
    jest
      .spyOn(service, 'getWallet')
      .mockResolvedValue({ id: 'hw-hidden', name: 'Hidden wallet' } as Awaited<
        ReturnType<typeof service.getWallet>
      >);
    jest.spyOn(service, 'getWalletDevice').mockResolvedValue(device);
    jest.spyOn(service, 'setWalletTempStatus').mockResolvedValue(undefined);
    await service.createHWHiddenWallet({ walletId: 'hw-saved' });
    expect(getCompatibleConnectId).not.toHaveBeenCalled();
    expect(getFeatures).toHaveBeenCalledWith(
      '',
      expect.objectContaining({
        expectedDeviceIdentity: {
          vendor: 'trezor',
          type: 'deviceId',
          value: device.deviceId,
        },
        knownConnections: [
          { transport: 'usb', connectId: 'saved-usb' },
          { transport: 'ble', connectId: 'saved-ble' },
        ],
      }),
    );
    expect(getTrezorPassphraseState).toHaveBeenCalledWith({
      connectId: '',
      dbDevice: device,
    });
    expect(createHwWalletMock).toHaveBeenCalledWith(
      expect.objectContaining({
        vendor: EHardwareVendor.trezor,
        passphraseState: 'fixture-hidden-state',
        device: expect.objectContaining({
          connectId: '',
          usbConnectId: 'saved-usb',
          bleConnectId: 'saved-ble',
        }),
      }),
    );
  });
});
