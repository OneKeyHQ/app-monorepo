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

jest.mock('../../states/jotai/atoms', () => ({
  EHardwareUiStateAction: {},
  firmwareUpdateWorkflowRunningAtom: {
    get: jest.fn(),
  },
  hardwareUiStateAtom: {
    get: jest.fn(),
    set: jest.fn(),
  },
  thirdPartyAppInstallAtom: {
    set: jest.fn(),
  },
  thirdPartyHardwareUiStateAtom: {
    set: jest.fn(),
  },
}));

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
