import { EDeviceType, HardwareErrorCode } from '@onekeyfe/hd-shared';

import {
  BluetoothUnavailableWhileUsbConnectedError,
  DeviceBondError,
  DeviceNotFound,
  NotInBootLoaderMode,
  OneKeyLocalError,
  UserCancel,
} from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EHardwareTransportType } from '@onekeyhq/shared/types';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import {
  deviceStageAtom,
  firmwareUpdateWorkflowRunningAtom,
} from '../../states/jotai/atoms';

import ServiceHardwareUI from './ServiceHardwareUI';

import type { IWithHardwareProcessingOptions } from './ServiceHardwareUI';
import type { IDeviceStageState } from '../../states/jotai/atoms';
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

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => {
  const actual = jest.requireActual<
    typeof import('@onekeyhq/shared/src/eventBus/appEventBus')
  >('@onekeyhq/shared/src/eventBus/appEventBus');
  // Error constructors can load the bus before this service's mocks through
  // the atom fixture. Observe that same emitter as well as service calls.
  const emit = jest
    .spyOn(actual.appEventBus, 'emit')
    .mockImplementation(() => false);
  return {
    ...actual,
    appEventBus: { on: jest.fn(), off: jest.fn(), emit },
  };
});

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
          invalidatePendingCancel: jest.fn(),
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
          invalidatePendingCancel: jest.fn(),
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
          invalidatePendingCancel: jest.fn(),
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

describe('ServiceHardwareUI.withHardwareProcessing stage ownership', () => {
  let stage: IDeviceStageState | undefined;
  let service: ServiceHardwareUI;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    stage = { step: 'off', burstId: 0 };
    jest.mocked(deviceStageAtom.get).mockImplementation(async () => stage);
    jest.mocked(deviceStageAtom.set).mockImplementation(async (next) => {
      stage = typeof next === 'function' ? next(stage) : next;
    });
    jest.mocked(firmwareUpdateWorkflowRunningAtom.get).mockResolvedValue(false);
    service = new ServiceHardwareUI({
      backgroundApi: {
        serviceHardware: {
          invalidatePendingCancel: jest.fn(),
          getFeaturesMutex: {
            isLocked: jest.fn(() => false),
            waitForUnlock: jest.fn(),
          },
        },
      },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.mocked(deviceStageAtom.get).mockReset();
    jest.mocked(deviceStageAtom.set).mockReset();
  });

  it.each([false, true])(
    'keeps the stage off while a non-hardware operation waits (rejects: %s)',
    async (rejects) => {
      const error = new OneKeyLocalError(
        'External wallet rejected the request',
      );
      const onFinally = jest.fn();
      const operation = service.withHardwareProcessing(
        async () => {
          await jest.advanceTimersByTimeAsync(500);
          expect(stage?.step).toBe('off');
          if (rejects) throw error;
          return 'signed';
        },
        { deviceParams: undefined, onFinally },
      );

      if (rejects) {
        await expect(operation).rejects.toBe(error);
      } else {
        await expect(operation).resolves.toBe('signed');
      }
      await jest.advanceTimersByTimeAsync(500);
      expect(stage?.step).toBe('off');
      expect(onFinally).toHaveBeenCalledTimes(1);
      expect(service.processingNestedNum).toBe(0);
    },
  );

  it('does not close a QR burst owned by another flow', async () => {
    await service.deviceStageBurst.begin({});
    await service.deviceStageBurst.qrShowCode({
      valueUr: { type: 'bytes', cbor: 'test' },
      sessionId: 1,
    });

    await service.withHardwareProcessing(async () => undefined, {
      deviceParams: undefined,
    });
    await jest.advanceTimersByTimeAsync(500);
    expect(stage?.step).toBe('showQr');

    await service.deviceStageBurst.end();
    await jest.advanceTimersByTimeAsync(500);
    expect(stage?.step).toBe('off');
  });

  it('lets the QR flow open and close its own stage inside the wrapper', async () => {
    await service.withHardwareProcessing(
      async () => {
        expect(await service.deviceStageBurst.begin({})).toBe(true);
        await service.deviceStageBurst.qrShowCode({
          valueUr: { type: 'bytes', cbor: 'test' },
          sessionId: 1,
        });
        await jest.advanceTimersByTimeAsync(500);
        expect(stage?.step).toBe('showQr');
        await service.deviceStageBurst.end();
      },
      { deviceParams: undefined },
    );
    await jest.advanceTimersByTimeAsync(500);
    expect(stage?.step).toBe('off');
  });

  it.each([
    { vendor: EHardwareVendor.onekey, externalPending: false },
    { vendor: EHardwareVendor.ledger, externalPending: false },
    { vendor: EHardwareVendor.trezor, externalPending: false },
    { vendor: EHardwareVendor.ledger, externalPending: true },
    { vendor: EHardwareVendor.trezor, externalPending: true },
  ])(
    'opens and closes $vendor hardware with externalPending=$externalPending',
    async ({ vendor, externalPending }) => {
      const deviceParams: IWithHardwareProcessingOptions['deviceParams'] = {
        dbDevice: {
          id: 'test-device',
          name: 'Test device',
          features: '',
          connectId: '',
          uuid: 'test-device',
          deviceId: 'test-device',
          deviceType: EDeviceType.Pro,
          settingsRaw: '',
          createdAt: 0,
          updatedAt: 0,
          vendor,
        },
      };
      let releaseExternal: (() => void) | undefined;
      const externalOperation = externalPending
        ? service.withHardwareProcessing(
            () =>
              new Promise<void>((resolve) => {
                releaseExternal = resolve;
              }),
            { deviceParams: undefined },
          )
        : undefined;
      await jest.advanceTimersByTimeAsync(0);
      try {
        await service.withHardwareProcessing(
          async () => {
            await jest.advanceTimersByTimeAsync(500);
            expect(stage?.step).toBe('connecting');
          },
          { deviceParams, skipCloseHardwareUiStateDialog: true },
        );
        await jest.advanceTimersByTimeAsync(3000);
        expect(stage?.step).toBe('off');
      } finally {
        releaseExternal?.();
        await externalOperation;
      }
    },
  );
});

describe('ServiceHardwareUI bootloader recovery handoff', () => {
  it.each([undefined, '', 'SDK_DEVICE_ID'])(
    'notifies recovery once before leaving the stage with SDK connectId %p',
    async (sdkConnectId) => {
      jest.clearAllMocks();
      const emit = jest.spyOn(appEventBus, 'emit');
      jest
        .mocked(firmwareUpdateWorkflowRunningAtom.get)
        .mockResolvedValue(false);
      const getStage = jest.spyOn(deviceStageAtom, 'get').mockResolvedValue({
        step: 'processing',
        burstId: 1,
      });
      const service = new ServiceHardwareUI({
        backgroundApi: {
          serviceHardware: {
            cancelTimer: undefined,
            invalidatePendingCancel: jest.fn(),
            getFeaturesMutex: {
              isLocked: jest.fn(() => false),
              waitForUnlock: jest.fn(),
            },
          },
          serviceAccount: { generateHwWalletsMissingXfp: jest.fn() },
          serviceFirmwareUpdate: {
            delayShouldDetectTimeCheck: jest.fn(),
            delayShouldDetectTimeCheckWithDelay: jest.fn(),
          },
        },
      });
      jest
        .spyOn(service, 'closeHardwareUiStateDialog')
        .mockResolvedValue(undefined);
      const serviceInternals = service as unknown as {
        withHardwareProcessingInternal: (
          operation: () => Promise<void>,
          options: {
            deviceParams: { dbDevice: { connectId: string } };
            hideCheckingDeviceLoading: boolean;
          },
        ) => Promise<void>;
      };
      const options = {
        deviceParams: { dbDevice: { connectId: 'CALL_DEVICE_ID' } },
        hideCheckingDeviceLoading: true,
      };
      try {
        // The inner catch can fill metadata before the same error reaches
        // the outer catch. Both must share one recovery notification.
        await expect(
          serviceInternals.withHardwareProcessingInternal(
            () =>
              serviceInternals.withHardwareProcessingInternal(async () => {
                const failure = new NotInBootLoaderMode({
                  payload: {
                    code: HardwareErrorCode.NotAllowInBootloaderMode,
                    connectId: sdkConnectId,
                  },
                });
                throw failure;
              }, options),
            options,
          ),
        ).rejects.toBeInstanceOf(NotInBootLoaderMode);

        const notifications = emit.mock.calls.filter(
          ([name]) =>
            name === EAppEventBusNames.ShowFirmwareUpdateFromBootloaderMode,
        );
        expect(notifications).toEqual([
          [
            EAppEventBusNames.ShowFirmwareUpdateFromBootloaderMode,
            {
              connectId: sdkConnectId || 'CALL_DEVICE_ID',
            },
          ],
        ]);
        expect(deviceStageAtom.set).toHaveBeenLastCalledWith(
          expect.objectContaining({ step: 'off' }),
        );
      } finally {
        getStage.mockRestore();
      }
    },
  );
});

describe('ServiceHardwareUI.withHardwareProcessing USB-priority cleanup', () => {
  it('does not send a follow-up cancel after BLE is disabled by USB priority', async () => {
    jest.mocked(firmwareUpdateWorkflowRunningAtom.get).mockResolvedValue(false);
    const service = new ServiceHardwareUI({
      backgroundApi: {
        serviceHardware: {
          cancelTimer: undefined,
          invalidatePendingCancel: jest.fn(),
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
          invalidatePendingCancel: jest.fn(),
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
          invalidatePendingCancel: jest.fn(),
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

  it('does not send another cancel after a Pro2 request is already cancelled', async () => {
    jest.mocked(firmwareUpdateWorkflowRunningAtom.get).mockResolvedValue(false);
    const service = new ServiceHardwareUI({
      backgroundApi: {
        serviceHardware: {
          cancelTimer: undefined,
          invalidatePendingCancel: jest.fn(),
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
      skipDeviceCancel: true,
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

describe('ServiceHardwareUI.deviceStageWaitForOff', () => {
  const createService = () =>
    new ServiceHardwareUI({ backgroundApi: {} as never });
  // The bus is a jest.fn() pair here (see the module mock); spied rather
  // than referenced, so the mock's calls are read without holding the
  // unbound method.
  const busOn = () => jest.spyOn(appEventBus, 'on');
  const busOff = () => jest.spyOn(appEventBus, 'off');
  const findOffListener = () =>
    busOn().mock.calls.find(
      ([name]) => name === EAppEventBusNames.DeviceStageOff,
    )?.[1] as (() => void) | undefined;

  beforeEach(() => {
    busOn().mockClear();
    busOff().mockClear();
  });

  it('does not miss an exit that lands while it reads the stage', async () => {
    // The exit is a one-shot event: fired between the read and the
    // subscription it used to be lost, and the caller sat out the full
    // timeout for a stage that was already gone.
    jest.useFakeTimers();
    try {
      const service = createService();
      jest
        .spyOn(service.deviceStageBurst, 'getLastOffAt')
        .mockReturnValue(Date.now());
      jest.mocked(deviceStageAtom.get).mockImplementation(async () => {
        const onOff = findOffListener();
        expect(onOff).toBeDefined();
        onOff?.();
        return { step: 'off', burstId: 1 } as never;
      });
      const waited = service.deviceStageWaitForOff({ timeoutMs: 4000 });
      await jest.advanceTimersByTimeAsync(0);
      await expect(waited).resolves.toBe(true);
      expect(jest.getTimerCount()).toBe(0);
      expect(busOff()).toHaveBeenCalledWith(
        EAppEventBusNames.DeviceStageOff,
        expect.any(Function),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('resolves on the exit event, not the timeout, and reports an old off as no wait', async () => {
    jest.useFakeTimers();
    try {
      const service = createService();
      jest
        .mocked(deviceStageAtom.get)
        .mockResolvedValue({ step: 'connecting', burstId: 1 } as never);
      const waited = service.deviceStageWaitForOff({ timeoutMs: 4000 });
      await jest.advanceTimersByTimeAsync(0);
      findOffListener()?.();
      await jest.advanceTimersByTimeAsync(0);
      await expect(waited).resolves.toBe(true);
      expect(jest.getTimerCount()).toBe(0);

      // Off for a while already: nothing is leaving, no beat to keep.
      jest.spyOn(service.deviceStageBurst, 'getLastOffAt').mockReturnValue(0);
      jest
        .mocked(deviceStageAtom.get)
        .mockResolvedValue({ step: 'off', burstId: 1 } as never);
      await expect(
        service.deviceStageWaitForOff({ timeoutMs: 4000 }),
      ).resolves.toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('ServiceHardwareUI.deviceStageUserClose', () => {
  const createService = () => {
    const cancelStageAirGapScan = jest.fn().mockResolvedValue(undefined);
    const cancelDevice = jest.fn().mockResolvedValue(undefined);
    const service = new ServiceHardwareUI({
      backgroundApi: {
        serviceHardware: { cancel: cancelDevice },
        serviceQrWallet: { cancelStageAirGapScan },
      } as never,
    });
    jest.spyOn(service.deviceStageBurst, 'userClose').mockResolvedValue();
    const close = jest
      .spyOn(service, 'closeHardwareUiStateDialogFn')
      .mockResolvedValue(undefined);
    return { service, close, cancelDevice };
  };

  beforeEach(() => {
    jest
      .mocked(deviceStageAtom.get)
      .mockResolvedValue({ step: 'connecting', burstId: 1 } as never);
  });

  it('skips the device half of the close when the stage never learned its device', async () => {
    // A connectId-less sdk.cancel is the GLOBAL cancel: it cold-boots the
    // SDK and interrupts every queued call on every connected device. A
    // stage closed before the search resolved has nothing to cancel by.
    const { service, close } = createService();

    await service.deviceStageUserClose({ connectId: undefined });

    expect(close).toHaveBeenCalledTimes(1);
    expect(close.mock.calls[0][0]).toMatchObject({
      connectId: undefined,
      skipDeviceCancel: true,
    });
  });

  it('still cancels on the device the stage names', async () => {
    const { service, close, cancelDevice } = createService();
    const cancelOperation = jest.spyOn(
      service.hardwareProcessingManager,
      'cancelOperation',
    );

    await service.hardwareProcessingManager.runExclusiveOneKeyOperation({
      operation: async (lease) => {
        await service.deviceStageUserClose({
          connectId: 'PRB09B0058A',
          skipDeviceCancel: false,
        });
        expect(lease.signal?.aborted).toBe(true);
      },
    });

    expect(close.mock.calls[0][0]).toMatchObject({
      connectId: 'PRB09B0058A',
      skipDeviceCancel: true,
      immediateDeviceCancel: true,
    });
    expect(cancelOperation).toHaveBeenCalledTimes(1);
    expect(cancelOperation).toHaveBeenCalledWith('PRB09B0058A');
    expect(cancelDevice).toHaveBeenCalledTimes(1);
  });

  it('does not cancel again after the stage has reached an error outcome', async () => {
    jest
      .mocked(deviceStageAtom.get)
      .mockResolvedValue({ step: 'error', burstId: 1 } as never);
    const { service, close, cancelDevice } = createService();

    await service.hardwareProcessingManager.runExclusiveOneKeyOperation({
      operation: async (lease) => {
        await service.deviceStageUserClose({ connectId: 'PRB09B0058A' });
        expect(lease.signal?.aborted).toBe(false);
      },
    });

    expect(close.mock.calls[0][0]).toMatchObject({
      connectId: 'PRB09B0058A',
      skipDeviceCancel: true,
    });
    expect(cancelDevice).not.toHaveBeenCalled();
  });
});

describe('ServiceHardwareUI delayed close ownership', () => {
  it('ignores a stale close after a newer burst acquired the lease', async () => {
    jest
      .mocked(deviceStageAtom.get)
      .mockResolvedValue({ step: 'connecting', burstId: 2 } as never);
    const service = new ServiceHardwareUI({ backgroundApi: {} as never });
    const close = jest
      .spyOn(service, 'closeHardwareUiStateDialogFn')
      .mockResolvedValue(undefined);

    await service.hardwareProcessingManager.runExclusiveOneKeyOperation({
      operation: async (lease) => {
        await service.closeHardwareUiStateDialog({
          connectId: 'same-device',
          deviceStageBurstId: 1,
          immediateDeviceCancel: true,
        });
        expect(lease.signal?.aborted).toBe(false);
      },
    });

    expect(close).not.toHaveBeenCalled();
  });

  it('does not attach an unowned delayed close to a newly acquired lease', async () => {
    jest.useFakeTimers({ doNotFake: ['performance'] });
    try {
      const service = new ServiceHardwareUI({ backgroundApi: {} as never });
      const close = jest
        .spyOn(service, 'closeHardwareUiStateDialogFn')
        .mockResolvedValue(undefined);
      await service.closeHardwareUiStateDialog({
        connectId: undefined,
        skipDeviceCancel: true,
      });
      await service.hardwareProcessingManager.runExclusiveOneKeyOperation({
        operation: async () => {
          await jest.advanceTimersByTimeAsync(600);
          expect(close).toHaveBeenCalledTimes(1);
        },
      });
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('ServiceHardwareUI.silenceDeviceStageForFirmwareWorkflow', () => {
  const createService = () => {
    const cancelStageAirGapScan = jest.fn().mockResolvedValue(undefined);
    const service = new ServiceHardwareUI({
      backgroundApi: {
        serviceQrWallet: { cancelStageAirGapScan },
      } as never,
    });
    const silence = jest
      .spyOn(service.deviceStageBurst, 'silence')
      .mockResolvedValue();
    return { service, silence, cancelStageAirGapScan };
  };

  it('rejects the air-gap scan the stage was hosting, naming the step it was on', async () => {
    // The stage is that scan's only surface: silenced without this, the
    // signing request waited invisibly for its 30-minute expiry while the
    // update page ran.
    jest
      .mocked(deviceStageAtom.get)
      .mockResolvedValue({ step: 'scanQr', burstId: 1 } as never);
    const { service, silence, cancelStageAirGapScan } = createService();

    await service.silenceDeviceStageForFirmwareWorkflow();

    expect(silence).toHaveBeenCalledTimes(1);
    expect(cancelStageAirGapScan).toHaveBeenCalledWith({ scanning: true });
  });

  it('speaks the code-display cancel when the person was still on the code', async () => {
    jest
      .mocked(deviceStageAtom.get)
      .mockResolvedValue({ step: 'showQr', burstId: 1 } as never);
    const { service, cancelStageAirGapScan } = createService();

    await service.silenceDeviceStageForFirmwareWorkflow();

    expect(cancelStageAirGapScan).toHaveBeenCalledWith({ scanning: false });
  });
});
