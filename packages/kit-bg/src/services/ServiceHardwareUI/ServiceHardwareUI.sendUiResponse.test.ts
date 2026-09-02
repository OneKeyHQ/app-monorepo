import { EDeviceType, HardwareErrorCode } from '@onekeyfe/hd-shared';

import {
  BluetoothUnavailableWhileUsbConnectedError,
  DeviceBondError,
  DeviceNotFound,
  OneKeyLocalError,
  UserCancel,
} from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EHardwareTransportType } from '@onekeyhq/shared/types';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { firmwareUpdateWorkflowRunningAtom } from '../../states/jotai/atoms';

import ServiceHardwareUI from './ServiceHardwareUI';

import type { UiResponseEvent } from '@onekeyfe/hd-core';

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
    HardwareDeviceStateUpdate: 'HardwareDeviceStateUpdate',
    HardwareFeaturesUpdate: 'HardwareFeaturesUpdate',
  },
  appEventBus: {
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
  },
}));

jest.mock('@onekeyhq/shared/src/locale/appLocale', () => ({
  appLocale: {
    intl: {
      formatMessage: jest.fn(() => 'Hardware is busy'),
    },
    onLocaleChange: jest.fn(),
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isDesktop: false, isJest: true, isNative: false },
}));

jest.mock('../../states/jotai/atoms', () => {
  // Real enum objects: the burst scope builds its action-to-step maps at
  // module scope, so stubbed members would collapse every key into a
  // single "undefined" — or throw outright, which is what a missing enum
  // did here.
  const { EHardwareUiStateAction, EThirdPartyHardwareUiAction } =
    jest.requireActual('../../states/jotai/atoms');
  return {
    EHardwareUiStateAction,
    EThirdPartyHardwareUiAction,
    firmwareUpdateWorkflowRunningAtom: {
      get: jest.fn(),
    },
    hardwareUiStateAtom: {
      get: jest.fn(),
      set: jest.fn(),
    },
    deviceStageAtom: {
      get: jest.fn(),
      set: jest.fn(),
    },
    thirdPartyAppInstallAtom: {
      get: jest.fn(),
      set: jest.fn(),
      sub: jest.fn(),
    },
    thirdPartyBatchInstallAtom: {
      get: jest.fn(),
      set: jest.fn(),
      sub: jest.fn(),
    },
    thirdPartyHardwareUiStateAtom: {
      get: jest.fn(),
      set: jest.fn(),
      sub: jest.fn(),
    },
  };
});

jest.mock('../../dbs/local/localDb', () => ({
  __esModule: true,
  default: {
    getDevice: jest.fn(),
  },
}));

describe('ServiceHardwareUI.sendUiResponse', () => {
  it('Pro2 通过 USB 连接时仍把 Pro BLE 的 Passphrase 回包交给当前 SDK', async () => {
    const sendUiResponseToActiveSdk = jest.fn();
    const sdkUiResponse = jest.fn();
    const getSDKInstance = jest.fn().mockResolvedValue({
      uiResponse: sdkUiResponse,
    });
    const service = new ServiceHardwareUI({
      backgroundApi: {
        serviceHardware: {
          getSDKInstance,
          sendUiResponseToActiveSdk,
        },
      },
    });
    const response = {
      type: 'ui-receive_passphrase',
      payload: {
        value: 'hidden wallet',
        passphraseOnDevice: false,
        attachPinOnDevice: false,
        save: false,
      },
      interactionId: 'pro-ble-interaction',
      deviceId: 'pro-device',
    } as UiResponseEvent;

    await service.sendUiResponse(response);

    expect(sendUiResponseToActiveSdk).toHaveBeenCalledWith(response);
    expect(getSDKInstance).not.toHaveBeenCalled();
    expect(sdkUiResponse).not.toHaveBeenCalled();
  });
});

describe('ServiceHardwareUI.withHardwareProcessing firmware update guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects a regular OneKey operation before it enters the hardware queue', async () => {
    jest.mocked(firmwareUpdateWorkflowRunningAtom.get).mockResolvedValue(true);
    const operation = jest.fn().mockResolvedValue(undefined);
    const service = new ServiceHardwareUI({ backgroundApi: {} });

    await expect(
      service.withHardwareProcessing(operation, {
        deviceParams: undefined,
      }),
    ).rejects.toMatchObject({
      message: 'Hardware is busy',
      autoToast: false,
    });
    expect(operation).not.toHaveBeenCalled();
    expect(service.processingNestedNum).toBe(0);
  });

  it.each([EHardwareVendor.ledger, EHardwareVendor.trezor])(
    'rejects a %s operation while firmware update exclusivity is active',
    async (vendor) => {
      jest
        .mocked(firmwareUpdateWorkflowRunningAtom.get)
        .mockResolvedValue(true);
      const operation = jest.fn().mockResolvedValue(undefined);
      const service = new ServiceHardwareUI({ backgroundApi: {} });

      await expect(
        service.withHardwareProcessing(operation, {
          deviceParams: {
            dbDevice: { vendor },
          } as never,
        }),
      ).rejects.toMatchObject({
        message: 'Hardware is busy',
        autoToast: false,
      });
      expect(operation).not.toHaveBeenCalled();
    },
  );

  it('allows the firmware workflow to acquire the existing hardware lease', async () => {
    jest.mocked(firmwareUpdateWorkflowRunningAtom.get).mockResolvedValue(true);
    const operation = jest.fn().mockResolvedValue('updated');
    const service = new ServiceHardwareUI({
      backgroundApi: {
        serviceHardware: {
          cancelTimer: undefined,
          getFeaturesMutex: {
            isLocked: jest.fn(() => false),
            waitForUnlock: jest.fn(),
          },
        },
      },
    });

    await expect(
      service.withHardwareProcessing(operation, {
        allowDuringFirmwareUpdate: true,
        deviceParams: undefined,
      }),
    ).resolves.toBe('updated');
    expect(operation).toHaveBeenCalledTimes(1);
    expect(service.processingNestedNum).toBe(0);
  });

  it('rejects regular operations while a firmware workflow is waiting for the hardware lease', async () => {
    jest.mocked(firmwareUpdateWorkflowRunningAtom.get).mockResolvedValue(false);
    let releaseActiveOperation: (() => void) | undefined;
    let markActiveOperationStarted: (() => void) | undefined;
    const activeOperation = new Promise<void>((resolve) => {
      releaseActiveOperation = resolve;
    });
    const activeOperationStarted = new Promise<void>((resolve) => {
      markActiveOperationStarted = resolve;
    });
    const service = new ServiceHardwareUI({
      backgroundApi: {
        serviceHardware: {
          cancelTimer: undefined,
          getFeaturesMutex: {
            isLocked: jest.fn(() => false),
            waitForUnlock: jest.fn(),
          },
        },
      },
    });
    const activePromise = service.withHardwareProcessing(
      async () => {
        markActiveOperationStarted?.();
        return activeOperation;
      },
      {
        deviceParams: undefined,
      },
    );
    await activeOperationStarted;

    const firmwarePromise = service.withHardwareProcessing(
      async () => 'updated',
      {
        allowDuringFirmwareUpdate: true,
        deviceParams: undefined,
      },
    );
    const regularOperation = jest.fn().mockResolvedValue(undefined);
    const regularPromise = service.withHardwareProcessing(regularOperation, {
      deviceParams: undefined,
    });
    let rejectionBeforeLeaseRelease: unknown;
    void regularPromise.catch((error: unknown) => {
      rejectionBeforeLeaseRelease = error;
    });
    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });

    const observedRejection = rejectionBeforeLeaseRelease;
    releaseActiveOperation?.();
    await Promise.allSettled([activePromise, firmwarePromise, regularPromise]);

    expect(observedRejection).toMatchObject({
      message: 'Hardware is busy',
      autoToast: false,
    });
    expect(regularOperation).not.toHaveBeenCalled();
  });

  it('keeps rejecting regular operations while a firmware retry is waiting', async () => {
    jest.mocked(firmwareUpdateWorkflowRunningAtom.get).mockResolvedValue(false);
    let releaseFirmwareOperation: ((value: string) => void) | undefined;
    let markFirmwareOperationStarted: (() => void) | undefined;
    const firmwareOperationStarted = new Promise<void>((resolve) => {
      markFirmwareOperationStarted = resolve;
    });
    const firmwareOperation = jest.fn(
      () =>
        new Promise<string>((resolve) => {
          releaseFirmwareOperation = resolve;
          markFirmwareOperationStarted?.();
        }),
    );
    const regularOperation = jest.fn().mockResolvedValue(undefined);
    const service = new ServiceHardwareUI({
      backgroundApi: {
        serviceHardware: {
          cancelTimer: undefined,
          getFeaturesMutex: {
            isLocked: jest.fn(() => false),
            waitForUnlock: jest.fn(),
          },
        },
      },
    });

    const firmwarePromise = service.withHardwareProcessing(firmwareOperation, {
      allowDuringFirmwareUpdate: true,
      deviceParams: undefined,
    });
    await firmwareOperationStarted;

    await expect(
      service.withHardwareProcessing(regularOperation, {
        deviceParams: undefined,
      }),
    ).rejects.toMatchObject({
      message: 'Hardware is busy',
      autoToast: false,
    });
    expect(regularOperation).not.toHaveBeenCalled();

    releaseFirmwareOperation?.('updated');
    await expect(firmwarePromise).resolves.toBe('updated');
    expect(service.processingNestedNum).toBe(0);
  });
});

describe('ServiceHardwareUI.withHardwareProcessing USB-priority cleanup', () => {
  it('does not send a follow-up cancel after BLE is disabled by USB priority', async () => {
    jest.mocked(firmwareUpdateWorkflowRunningAtom.get).mockResolvedValue(false);
    const service = new ServiceHardwareUI({
      backgroundApi: {
        serviceHardware: {
          cancelTimer: undefined,
          getFeaturesMutex: {
            isLocked: jest.fn(() => false),
            waitForUnlock: jest.fn(),
          },
        },
        serviceAccount: {
          generateHwWalletsMissingXfp: jest.fn(),
        },
        serviceFirmwareUpdate: {
          delayShouldDetectTimeCheck: jest.fn(),
          delayShouldDetectTimeCheckWithDelay: jest.fn(),
        },
      },
    });
    const closeHardwareUiStateDialog = jest
      .spyOn(service, 'closeHardwareUiStateDialog')
      .mockResolvedValue(undefined);
    const serviceInternals = service as unknown as {
      withHardwareProcessingInternal: <T>(
        operation: () => Promise<T>,
        options: {
          deviceParams: {
            dbDevice: {
              connectId: string;
            };
          };
          hideCheckingDeviceLoading: boolean;
        },
      ) => Promise<T>;
    };

    await expect(
      serviceInternals.withHardwareProcessingInternal(
        async () => {
          throw new BluetoothUnavailableWhileUsbConnectedError();
        },
        {
          deviceParams: {
            dbDevice: {
              connectId: 'PRO2_BLE_ID',
            },
          },
          hideCheckingDeviceLoading: true,
        },
      ),
    ).rejects.toBeInstanceOf(BluetoothUnavailableWhileUsbConnectedError);

    expect(closeHardwareUiStateDialog).toHaveBeenCalledWith({
      connectId: 'PRO2_BLE_ID',
      deviceResetToHome: false,
      skipDeviceCancel: true,
      deviceType: undefined,
    });
  });

  it('does not send a follow-up cancel after Bluetooth pairing fails', async () => {
    jest.mocked(firmwareUpdateWorkflowRunningAtom.get).mockResolvedValue(false);
    const service = new ServiceHardwareUI({
      backgroundApi: {
        serviceHardware: {
          cancelTimer: undefined,
          getFeaturesMutex: {
            isLocked: jest.fn(() => false),
            waitForUnlock: jest.fn(),
          },
        },
        serviceAccount: {
          generateHwWalletsMissingXfp: jest.fn(),
        },
        serviceFirmwareUpdate: {
          delayShouldDetectTimeCheck: jest.fn(),
          delayShouldDetectTimeCheckWithDelay: jest.fn(),
        },
      },
    });
    const closeHardwareUiStateDialog = jest
      .spyOn(service, 'closeHardwareUiStateDialog')
      .mockResolvedValue(undefined);
    const serviceInternals = service as unknown as {
      withHardwareProcessingInternal: <T>(
        operation: () => Promise<T>,
        options: {
          deviceParams: {
            dbDevice: {
              connectId: string;
              deviceType: EDeviceType;
            };
          };
          hideCheckingDeviceLoading: boolean;
        },
      ) => Promise<T>;
    };

    await expect(
      serviceInternals.withHardwareProcessingInternal(
        async () => {
          throw new DeviceNotFound({
            silentMode: true,
            payload: {
              connectId: 'PRO2_USB',
              code: HardwareErrorCode.DeviceNotFound,
              inBluetoothCommunication: true,
            },
          });
        },
        {
          deviceParams: {
            dbDevice: {
              connectId: 'PRO2_USB',
              deviceType: EDeviceType.Pro2,
            },
          },
          hideCheckingDeviceLoading: true,
        },
      ),
    ).rejects.toBeInstanceOf(DeviceNotFound);

    expect(closeHardwareUiStateDialog).toHaveBeenCalledWith({
      connectId: 'PRO2_USB',
      deviceResetToHome: false,
      skipDeviceCancel: true,
      deviceType: EDeviceType.Pro2,
    });
  });

  it('does not send a follow-up cancel after a BLE bond error', async () => {
    jest.mocked(firmwareUpdateWorkflowRunningAtom.get).mockResolvedValue(false);
    const service = new ServiceHardwareUI({
      backgroundApi: {
        serviceHardware: {
          cancelTimer: undefined,
          getFeaturesMutex: {
            isLocked: jest.fn(() => false),
            waitForUnlock: jest.fn(),
          },
        },
        serviceAccount: {
          generateHwWalletsMissingXfp: jest.fn(),
        },
        serviceFirmwareUpdate: {
          delayShouldDetectTimeCheck: jest.fn(),
          delayShouldDetectTimeCheckWithDelay: jest.fn(),
        },
      },
    });
    const closeHardwareUiStateDialog = jest
      .spyOn(service, 'closeHardwareUiStateDialog')
      .mockResolvedValue(undefined);
    const serviceInternals = service as unknown as {
      withHardwareProcessingInternal: <T>(
        operation: () => Promise<T>,
        options: {
          deviceParams: {
            dbDevice: {
              connectId: string;
              deviceType: EDeviceType;
            };
          };
          hideCheckingDeviceLoading: boolean;
        },
      ) => Promise<T>;
    };

    await expect(
      serviceInternals.withHardwareProcessingInternal(
        async () => {
          throw new DeviceBondError({
            payload: {
              connectId: 'PRO2_BLE_ID',
              code: HardwareErrorCode.BleDeviceBondError,
            },
          });
        },
        {
          deviceParams: {
            dbDevice: {
              connectId: 'PRO2_BLE_ID',
              deviceType: EDeviceType.Pro2,
            },
          },
          hideCheckingDeviceLoading: true,
        },
      ),
    ).rejects.toBeInstanceOf(DeviceBondError);

    expect(closeHardwareUiStateDialog).toHaveBeenCalledWith({
      connectId: 'PRO2_BLE_ID',
      deviceResetToHome: false,
      skipDeviceCancel: true,
      deviceType: EDeviceType.Pro2,
    });
  });

  it('still sends cancel after the user dismisses a Pro2 hardware prompt', async () => {
    jest.mocked(firmwareUpdateWorkflowRunningAtom.get).mockResolvedValue(false);
    const service = new ServiceHardwareUI({
      backgroundApi: {
        serviceHardware: {
          cancelTimer: undefined,
          getFeaturesMutex: {
            isLocked: jest.fn(() => false),
            waitForUnlock: jest.fn(),
          },
        },
        serviceAccount: {
          generateHwWalletsMissingXfp: jest.fn(),
        },
        serviceFirmwareUpdate: {
          delayShouldDetectTimeCheck: jest.fn(),
          delayShouldDetectTimeCheckWithDelay: jest.fn(),
        },
      },
    });
    const closeHardwareUiStateDialog = jest
      .spyOn(service, 'closeHardwareUiStateDialog')
      .mockResolvedValue(undefined);
    const serviceInternals = service as unknown as {
      withHardwareProcessingInternal: <T>(
        operation: () => Promise<T>,
        options: {
          deviceParams: {
            dbDevice: {
              connectId: string;
              deviceType: EDeviceType;
            };
          };
          hideCheckingDeviceLoading: boolean;
        },
      ) => Promise<T>;
    };

    await expect(
      serviceInternals.withHardwareProcessingInternal(
        async () => {
          throw new UserCancel({
            payload: {
              connectId: 'PRO2_USB',
              code: HardwareErrorCode.ActionCancelled,
            },
          });
        },
        {
          deviceParams: {
            dbDevice: {
              connectId: 'PRO2_USB',
              deviceType: EDeviceType.Pro2,
            },
          },
          hideCheckingDeviceLoading: true,
        },
      ),
    ).rejects.toBeInstanceOf(UserCancel);

    expect(closeHardwareUiStateDialog).toHaveBeenCalledWith({
      connectId: 'PRO2_USB',
      deviceResetToHome: false,
      skipDeviceCancel: false,
      deviceType: EDeviceType.Pro2,
    });
  });
});

describe('ServiceHardwareUI Portfolio BLE resume notification', () => {
  beforeEach(() => {
    Object.assign(platformEnv, { isDesktop: false, isNative: true });
    jest.mocked(firmwareUpdateWorkflowRunningAtom.get).mockResolvedValue(false);
  });

  afterEach(() => {
    Object.assign(platformEnv, { isDesktop: false, isNative: false });
  });

  function prepareService() {
    const notifyInteractiveHardwareOperationStarted = jest
      .fn()
      .mockResolvedValue(1);
    const notifyInteractiveHardwareOperationSucceeded = jest
      .fn()
      .mockResolvedValue(true);
    const service = new ServiceHardwareUI({
      backgroundApi: {
        serviceHardware: {
          getCurrentTransportType: jest
            .fn()
            .mockResolvedValue(EHardwareTransportType.DesktopWebBle),
        },
        serviceHardwarePortfolioSync: {
          notifyInteractiveHardwareOperationStarted,
          notifyInteractiveHardwareOperationSucceeded,
        },
      },
    });
    const serviceInternals = service as unknown as {
      runExclusiveOneKeyOperation: (
        operation: (lease: object) => Promise<unknown>,
      ) => Promise<unknown>;
      withHardwareProcessingInternal: (
        operation: () => Promise<unknown>,
      ) => Promise<unknown>;
    };
    serviceInternals.runExclusiveOneKeyOperation = async (operation) =>
      operation({ owner: Symbol('test') });
    serviceInternals.withHardwareProcessingInternal = async (operation) =>
      operation();
    return {
      notifyInteractiveHardwareOperationStarted,
      notifyInteractiveHardwareOperationSucceeded,
      service,
      serviceInternals,
    };
  }

  it('resumes Portfolio only after a successful native user operation', async () => {
    const { notifyInteractiveHardwareOperationSucceeded, service } =
      prepareService();

    await expect(
      service.withHardwareProcessing(async () => 'address', {
        deviceParams: {
          dbDevice: {
            connectId: 'PRO2_BLE_ID',
            connectProtocol: 'V2',
            deviceType: EDeviceType.Pro2,
            id: 'db-device-1',
            vendor: EHardwareVendor.onekey,
          },
        } as never,
      }),
    ).resolves.toBe('address');

    expect(notifyInteractiveHardwareOperationSucceeded).toHaveBeenCalledWith({
      connectId: 'PRO2_BLE_ID',
      deviceDbId: 'db-device-1',
    });
  });

  it('keeps Portfolio suspended when the native user operation fails', async () => {
    const { notifyInteractiveHardwareOperationSucceeded, service } =
      prepareService();

    await expect(
      service.withHardwareProcessing(
        async () => {
          throw new OneKeyLocalError('link disabled');
        },
        {
          deviceParams: {
            dbDevice: {
              connectId: 'PRO2_BLE_ID',
              connectProtocol: 'V2',
              deviceType: EDeviceType.Pro2,
              id: 'db-device-1',
              vendor: EHardwareVendor.onekey,
            },
          } as never,
        },
      ),
    ).rejects.toThrow('link disabled');

    expect(notifyInteractiveHardwareOperationSucceeded).not.toHaveBeenCalled();
  });

  it('arms desktop Portfolio sync only after a successful BLE operation', async () => {
    Object.assign(platformEnv, { isDesktop: true, isNative: false });
    const {
      notifyInteractiveHardwareOperationStarted,
      notifyInteractiveHardwareOperationSucceeded,
      service,
    } = prepareService();

    await expect(
      service.withHardwareProcessing(async () => 'address', {
        deviceParams: {
          dbDevice: {
            connectId: 'PRO2_USB_ID',
            connectProtocol: 'V2',
            deviceType: EDeviceType.Pro2,
            id: 'db-device-1',
            vendor: EHardwareVendor.onekey,
          },
        } as never,
      }),
    ).resolves.toBe('address');
    await Promise.resolve();

    expect(notifyInteractiveHardwareOperationStarted).toHaveBeenCalledWith({
      connectId: 'PRO2_USB_ID',
      deviceDbId: 'db-device-1',
    });
    expect(notifyInteractiveHardwareOperationSucceeded).toHaveBeenCalledWith({
      connectId: 'PRO2_USB_ID',
      deviceDbId: 'db-device-1',
      interactionGeneration: 1,
      transportType: EHardwareTransportType.DesktopWebBle,
    });
  });

  it('does not notify Portfolio sync for an unsupported desktop device', async () => {
    Object.assign(platformEnv, { isDesktop: true, isNative: false });
    const {
      notifyInteractiveHardwareOperationStarted,
      notifyInteractiveHardwareOperationSucceeded,
      service,
    } = prepareService();

    await expect(
      service.withHardwareProcessing(async () => 'address', {
        deviceParams: {
          dbDevice: {
            connectId: 'CLASSIC_BLE_ID',
            connectProtocol: 'V1',
            deviceType: EDeviceType.Classic,
            id: 'db-device-1',
            vendor: EHardwareVendor.onekey,
          },
        } as never,
      }),
    ).resolves.toBe('address');

    expect(notifyInteractiveHardwareOperationStarted).not.toHaveBeenCalled();
    expect(notifyInteractiveHardwareOperationSucceeded).not.toHaveBeenCalled();
  });

  it('keeps the existing Portfolio lease when firmware preflight rejects', async () => {
    Object.assign(platformEnv, { isDesktop: true, isNative: false });
    jest.mocked(firmwareUpdateWorkflowRunningAtom.get).mockResolvedValue(true);
    const { notifyInteractiveHardwareOperationStarted, service } =
      prepareService();

    await expect(
      service.withHardwareProcessing(async () => 'address', {
        deviceParams: {
          dbDevice: {
            connectId: 'PRO2_BLE_ID',
            connectProtocol: 'V2',
            deviceType: EDeviceType.Pro2,
            id: 'db-device-1',
            vendor: EHardwareVendor.onekey,
          },
        } as never,
      }),
    ).rejects.toThrow('Hardware is busy');

    expect(notifyInteractiveHardwareOperationStarted).not.toHaveBeenCalled();
  });

  it('keeps the existing Portfolio lease when internal preflight rejects', async () => {
    Object.assign(platformEnv, { isDesktop: true, isNative: false });
    const {
      notifyInteractiveHardwareOperationStarted,
      service,
      serviceInternals,
    } = prepareService();
    serviceInternals.withHardwareProcessingInternal = async () => {
      throw new OneKeyLocalError('Hardware is busy');
    };

    await expect(
      service.withHardwareProcessing(async () => 'address', {
        deviceParams: {
          dbDevice: {
            connectId: 'PRO2_BLE_ID',
            connectProtocol: 'V2',
            deviceType: EDeviceType.Pro2,
            id: 'db-device-1',
            vendor: EHardwareVendor.onekey,
          },
        } as never,
      }),
    ).rejects.toThrow('Hardware is busy');

    expect(notifyInteractiveHardwareOperationStarted).not.toHaveBeenCalled();
  });

  it('arms desktop Portfolio sync only after the outer leased operation finishes', async () => {
    Object.assign(platformEnv, { isDesktop: true, isNative: false });
    const {
      notifyInteractiveHardwareOperationStarted,
      notifyInteractiveHardwareOperationSucceeded,
      service,
    } = prepareService();
    const deviceParams = {
      dbDevice: {
        connectId: 'PRO2_BLE_ID',
        connectProtocol: 'V2',
        deviceType: EDeviceType.Pro2,
        id: 'db-device-1',
        vendor: EHardwareVendor.onekey,
      },
    } as never;

    await service.withHardwareProcessing(
      async (oneKeyOperationLease) => {
        await service.withHardwareProcessing(async () => 'inner', {
          deviceParams,
          oneKeyOperationLease,
        });
        expect(
          notifyInteractiveHardwareOperationSucceeded,
        ).not.toHaveBeenCalled();
        return 'outer';
      },
      { deviceParams },
    );
    await Promise.resolve();

    expect(notifyInteractiveHardwareOperationStarted).toHaveBeenCalledTimes(1);
    expect(notifyInteractiveHardwareOperationSucceeded).toHaveBeenCalledTimes(
      1,
    );
    expect(notifyInteractiveHardwareOperationSucceeded).toHaveBeenCalledWith({
      connectId: 'PRO2_BLE_ID',
      deviceDbId: 'db-device-1',
      interactionGeneration: 1,
      transportType: EHardwareTransportType.DesktopWebBle,
    });
  });

  it('keeps native Portfolio suspended when an outer leased operation fails', async () => {
    const { notifyInteractiveHardwareOperationSucceeded, service } =
      prepareService();
    const deviceParams = {
      dbDevice: {
        connectId: 'PRO2_BLE_ID',
        connectProtocol: 'V2',
        deviceType: EDeviceType.Pro2,
        id: 'db-device-1',
        vendor: EHardwareVendor.onekey,
      },
    } as never;

    await expect(
      service.withHardwareProcessing(
        async (oneKeyOperationLease) => {
          await service.withHardwareProcessing(async () => 'inner', {
            deviceParams,
            oneKeyOperationLease,
          });
          throw new OneKeyLocalError('outer failed');
        },
        { deviceParams },
      ),
    ).rejects.toThrow('outer failed');

    expect(notifyInteractiveHardwareOperationSucceeded).not.toHaveBeenCalled();
  });
});
