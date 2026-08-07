import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EHardwareTransportType } from '@onekeyhq/shared/types';
import {
  EHardwareVendor,
  type ICheckAllFirmwareReleaseResult,
} from '@onekeyhq/shared/types/device';

import localDb from '../../dbs/local/localDb';
import {
  firmwareUpdateRetryAtom,
  firmwareUpdateWorkflowRunningAtom,
  hardwareUiStateCompletedAtom,
} from '../../states/jotai/atoms';

import ServiceFirmwareUpdate, {
  buildPro2TargetsToUpdate,
  supportsFirmwareUpdateWorkflowV2,
} from './ServiceFirmwareUpdate';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';
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

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    ShowFirmwareUpdateFromBootloaderMode:
      'ShowFirmwareUpdateFromBootloaderMode',
  },
  appEventBus: {
    emit: jest.fn(),
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isDesktop: true,
    isJest: true,
    isNative: false,
    isSupportDesktopBle: true,
    symbol: 'web',
  },
}));

jest.mock('@onekeyhq/shared/src/hardware/instance', () => ({
  CoreSDKLoader: jest.fn(),
}));

jest.mock('../../dbs/local/localDb', () => ({
  __esModule: true,
  default: {
    getDeviceByQuery: jest.fn(),
  },
}));

jest.mock('../../states/jotai/atoms', () => ({
  EFirmwareUpdateSteps: {
    init: 'init',
  },
  EHardwareUiStateAction: {},
  firmwareUpdateResultVerifyAtom: {
    set: jest.fn(),
  },
  firmwareUpdateRetryAtom: {
    get: jest.fn(),
    set: jest.fn(),
  },
  firmwareUpdateStepInfoAtom: {
    set: jest.fn(),
  },
  firmwareUpdateWorkflowRunningAtom: {
    get: jest.fn(),
    set: jest.fn(),
  },
  firmwareUpdatesDetectStatusPersistAtom: {
    set: jest.fn(),
  },
  hardwareUiStateAtom: {
    set: jest.fn(),
  },
  hardwareUiStateCompletedAtom: {
    set: jest.fn(),
  },
}));

jest.mock('../ServiceHardware/serviceHardwareUtils', () => ({
  __esModule: true,
  default: {
    hardwareLog: jest.fn(),
  },
}));

const mockedLocalDb = jest.mocked(localDb);
describe('ServiceFirmwareUpdate.detectActiveAccountFirmwareUpdates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([EHardwareVendor.trezor, EHardwareVendor.ledger])(
    'skips %s devices before touching the OneKey hardware SDK path',
    async (vendor) => {
      mockedLocalDb.getDeviceByQuery.mockResolvedValue({
        id: 'db-device-1',
        connectId: 'THIRD_PARTY_USB_ID',
        usbConnectId: 'THIRD_PARTY_USB_ID',
        deviceId: 'THIRD_PARTY_DEVICE_ID',
        vendor,
        name: 'Third-party device',
        features: '{}',
        settingsRaw: '{}',
        createdAt: 0,
        updatedAt: 0,
      } as IDBDevice);

      const getCompatibleConnectId = jest.fn();
      const service = new ServiceFirmwareUpdate({
        backgroundApi: {
          serviceHardware: {
            getCompatibleConnectId,
          },
        } as unknown as IBackgroundApi,
      });

      await service.detectActiveAccountFirmwareUpdates({
        connectId: 'THIRD_PARTY_USB_ID',
      });

      expect(getCompatibleConnectId).not.toHaveBeenCalled();
    },
  );
});

describe('buildPro2TargetsToUpdate', () => {
  it('uses SDK targets when no developer override is configured', () => {
    expect(
      buildPro2TargetsToUpdate({
        sdkTargets: ['app_v1', 'resource'],
      }),
    ).toEqual(['app_v1', 'resource']);
  });

  it('does not infer a resource update from an app update', () => {
    expect(
      buildPro2TargetsToUpdate({
        sdkTargets: ['app_v1'],
      }),
    ).toEqual(['app_v1']);
  });

  it('deduplicates SDK update targets', () => {
    expect(
      buildPro2TargetsToUpdate({
        sdkTargets: ['se01', 'se01', 'resource'],
      }),
    ).toEqual(['se01', 'resource']);
  });

  it('keeps boot resources independent from stable resources', () => {
    expect(
      buildPro2TargetsToUpdate({
        sdkTargets: ['resource', 'boot_resources'],
      }),
    ).toEqual(['resource', 'boot_resources']);
  });

  it('merges and deduplicates developer force targets after SDK targets', () => {
    expect(
      buildPro2TargetsToUpdate({
        sdkTargets: ['app_v1', 'resource'],
        forceTargets: ['resource', 'se01'],
      }),
    ).toEqual(['app_v1', 'resource', 'se01']);
  });
});

describe('supportsFirmwareUpdateWorkflowV2', () => {
  it.each([
    ['Pro', 'pro'],
    ['Pro2', 'pro2'],
    ['Neo', 'neo'],
  ])('allows %s devices', (_name, deviceType) => {
    expect(supportsFirmwareUpdateWorkflowV2(deviceType)).toBe(true);
  });

  it.each([
    ['Classic', 'classic'],
    ['Touch', 'touch'],
    ['unknown', undefined],
  ])('rejects %s devices', (_name, deviceType) => {
    expect(supportsFirmwareUpdateWorkflowV2(deviceType)).toBe(false);
  });
});

describe('ServiceFirmwareUpdate Pro2 developer settings', () => {
  it('clears one-time Pro2 targets with the other one-time overrides', async () => {
    const updateFirmwareUpdateDevSettings = jest.fn();
    const service = new ServiceFirmwareUpdate({
      backgroundApi: {
        serviceDevSetting: { updateFirmwareUpdateDevSettings },
      } as unknown as IBackgroundApi,
    });

    await service.clearOnceUpdateDevSettings();

    expect(updateFirmwareUpdateDevSettings).toHaveBeenCalledWith({
      forceUpdateOnceFirmware: false,
      forceUpdateOnceBle: false,
      forceUpdateOnceBootloader: false,
      pro2ForceUpdateOnceTargets: [],
    });
  });
});

describe('ServiceFirmwareUpdate Pro2 resource update options', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps an SDK-selected resource target on the incremental inventory path', async () => {
    const firmwareUpdateV4 = jest.fn().mockResolvedValue({
      success: true,
      payload: {},
    });
    const hardwareSDK = {
      firmwareUpdateV4,
      on: jest.fn(),
      off: jest.fn(),
    };
    jest.spyOn(timerUtils, 'wait').mockResolvedValue(undefined);

    const service = new ServiceFirmwareUpdate({
      backgroundApi: {
        serviceHardware: {
          getSDKInstance: jest.fn().mockResolvedValue(hardwareSDK),
        },
        serviceSetting: {
          getHardwareTransportType: jest
            .fn()
            .mockResolvedValue(EHardwareTransportType.WEBUSB),
        },
        serviceDevSetting: {
          getFirmwareUpdateDevSettings: jest.fn(async (key: string) => {
            if (key === 'forceUpdateResEvenSameVersion') {
              return false;
            }
            return undefined;
          }),
        },
      } as unknown as IBackgroundApi,
    });

    await service.updatingFirmwareV3({
      connectId: 'PRO2_CONNECT_ID',
      bleVersion: undefined,
      firmwareVersion: undefined,
      bootloaderVersion: undefined,
      firmwareType: undefined,
      isPro2Device: true,
      pro2TargetsToUpdate: ['resource'],
    });

    expect(firmwareUpdateV4).toHaveBeenCalledTimes(1);
    expect(firmwareUpdateV4.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        forcedUpdateRes: false,
        targetsToUpdate: ['resource'],
      }),
    );
  });

  it('keeps the BLE peripheral ID when the active transport is desktop BLE', async () => {
    const firmwareUpdateV4 = jest.fn().mockResolvedValue({
      success: true,
      payload: {},
    });
    const hardwareSDK = {
      firmwareUpdateV4,
      on: jest.fn(),
      off: jest.fn(),
    };
    const bleConnectId = 'f7e440001d2c1c79509d55dfdc8201ff';
    const getSDKInstance = jest.fn().mockResolvedValue(hardwareSDK);
    jest.spyOn(timerUtils, 'wait').mockResolvedValue(undefined);

    const service = new ServiceFirmwareUpdate({
      backgroundApi: {
        serviceHardware: {
          getSDKInstance,
          getCurrentTransportType: jest
            .fn()
            .mockResolvedValue(EHardwareTransportType.DesktopWebBle),
        },
        // 持久化值可能仍是上一轮 USB；升级必须以连接管理器的实际值为准。
        serviceSetting: {
          getHardwareTransportType: jest
            .fn()
            .mockResolvedValue(EHardwareTransportType.WEBUSB),
        },
        serviceDevSetting: {
          getFirmwareUpdateDevSettings: jest.fn().mockResolvedValue(false),
        },
      } as unknown as IBackgroundApi,
    });

    await service.updatingFirmwareV3({
      connectId: bleConnectId,
      bleVersion: undefined,
      firmwareVersion: undefined,
      bootloaderVersion: undefined,
      firmwareType: undefined,
      isPro2Device: true,
      pro2TargetsToUpdate: ['app_v1'],
    });

    expect(firmwareUpdateV4).toHaveBeenCalledWith(
      bleConnectId,
      expect.objectContaining({ targetsToUpdate: ['app_v1'] }),
    );
    expect(getSDKInstance).toHaveBeenCalledWith({
      connectId: bleConnectId,
      hardwareTransportType: EHardwareTransportType.DesktopWebBle,
    });
  });
});

describe('ServiceFirmwareUpdate workflow tracking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('excludes time spent waiting for the user to retry', async () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1000);
    const service = new ServiceFirmwareUpdate({
      backgroundApi: {} as IBackgroundApi,
    });

    const workflowId = service.resetUpdateWorkflowTracking({
      updateFlow: 'v1',
      releaseResult: {} as ICheckAllFirmwareReleaseResult,
    });

    nowSpy.mockReturnValue(1600);
    service.pauseUpdateWorkflowTracking(workflowId);

    nowSpy.mockReturnValue(10_000);
    expect(await service.getUpdateWorkflowTrackingInfo()).toEqual({
      retryCount: 0,
      durationMs: 600,
    });

    service.resumeUpdateWorkflowTracking(workflowId);
    nowSpy.mockReturnValue(10_300);
    expect(await service.getUpdateWorkflowTrackingInfo()).toEqual({
      retryCount: 0,
      durationMs: 900,
    });
  });

  it('tracks failed and successful attempts with one sequence', async () => {
    const attemptResultSpy = jest
      .spyOn(defaultLogger.update.firmware, 'firmwareUpdateAttemptResult')
      .mockImplementation((params) => params);
    const service = new ServiceFirmwareUpdate({
      backgroundApi: {
        serviceSetting: {
          getHardwareTransportType: jest
            .fn()
            .mockResolvedValue(EHardwareTransportType.BLE),
        },
      } as unknown as IBackgroundApi,
    });

    const workflowId = service.resetUpdateWorkflowTracking({
      updateFlow: 'v1',
      releaseResult: {
        updateInfos: {},
      } as ICheckAllFirmwareReleaseResult,
    });

    await service.trackUpdateTaskAttemptResult({
      workflowId,
      status: 'failed',
      error: new Error('first failure'),
    });
    expect(await service.getUpdateWorkflowTrackingInfo()).toEqual(
      expect.objectContaining({ retryCount: 0 }),
    );

    service.recordUpdateWorkflowRetry(workflowId);
    await service.trackUpdateTaskAttemptResult({
      workflowId,
      status: 'failed',
      error: new Error('second failure'),
    });
    service.recordUpdateWorkflowRetry(workflowId);
    await service.trackUpdateTaskAttemptResult({
      workflowId,
      status: 'success',
    });

    expect(attemptResultSpy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ attempt: 1, status: 'failed' }),
    );
    expect(attemptResultSpy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ attempt: 2, status: 'failed' }),
    );
    expect(attemptResultSpy).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ attempt: 3, status: 'success' }),
    );
    expect(await service.getUpdateWorkflowTrackingInfo()).toEqual(
      expect.objectContaining({ retryCount: 2 }),
    );
  });

  it('keeps attempt numbers stable when analytics resolves out of order', async () => {
    let resolveFirstTransport!: (value: EHardwareTransportType) => void;
    const firstTransport = new Promise<EHardwareTransportType>((resolve) => {
      resolveFirstTransport = resolve;
    });
    const attemptResultSpy = jest
      .spyOn(defaultLogger.update.firmware, 'firmwareUpdateAttemptResult')
      .mockImplementation((params) => params);
    const service = new ServiceFirmwareUpdate({
      backgroundApi: {
        serviceSetting: {
          getHardwareTransportType: jest
            .fn()
            .mockReturnValueOnce(firstTransport)
            .mockResolvedValueOnce(EHardwareTransportType.BLE),
        },
      } as unknown as IBackgroundApi,
    });
    const workflowId = service.resetUpdateWorkflowTracking({
      updateFlow: 'v1',
      releaseResult: {
        updateInfos: {},
      } as ICheckAllFirmwareReleaseResult,
    });

    const firstAttempt = service.trackUpdateTaskAttemptResult({
      workflowId,
      status: 'failed',
      error: new Error('first failure'),
    });
    const secondAttempt = service.trackUpdateTaskAttemptResult({
      workflowId,
      status: 'success',
    });
    await secondAttempt;
    resolveFirstTransport(EHardwareTransportType.BLE);
    await firstAttempt;

    expect(attemptResultSpy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ attempt: 2, status: 'success' }),
    );
    expect(attemptResultSpy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ attempt: 1, status: 'failed' }),
    );
  });

  it('ignores a late task failure after a new workflow starts', async () => {
    jest.mocked(firmwareUpdateWorkflowRunningAtom.get).mockResolvedValue(true);
    jest.mocked(firmwareUpdateRetryAtom.get).mockResolvedValue(undefined);
    const attemptResultSpy = jest
      .spyOn(defaultLogger.update.firmware, 'firmwareUpdateAttemptResult')
      .mockImplementation((params) => params);
    const service = new ServiceFirmwareUpdate({
      backgroundApi: {} as IBackgroundApi,
    });
    const firstWorkflowId = service.resetUpdateWorkflowTracking({
      updateFlow: 'v1',
      releaseResult: {
        updateInfos: {},
      } as ICheckAllFirmwareReleaseResult,
    });

    service.updateTasks[1] = {
      workflowId: firstWorkflowId,
      fn: jest.fn(async () => {
        service.resetUpdateWorkflowTracking({
          updateFlow: 'v2',
          releaseResult: {
            updateInfos: {},
          } as ICheckAllFirmwareReleaseResult,
        });
        throw new OneKeyLocalError('late failure');
      }),
    };

    await service.runUpdateTask({ id: 1 });

    expect(attemptResultSpy).not.toHaveBeenCalled();
    expect(firmwareUpdateRetryAtom.set).toHaveBeenCalledTimes(1);
    expect(await service.getUpdateWorkflowTrackingInfo()).toEqual(
      expect.objectContaining({ retryCount: 0 }),
    );
  });

  it('ignores task results after the user exits the workflow', async () => {
    const attemptResultSpy = jest
      .spyOn(defaultLogger.update.firmware, 'firmwareUpdateAttemptResult')
      .mockImplementation((params) => params);
    const service = new ServiceFirmwareUpdate({
      backgroundApi: {} as IBackgroundApi,
    });
    const workflowId = service.resetUpdateWorkflowTracking({
      updateFlow: 'v1',
      releaseResult: {
        updateInfos: {},
      } as ICheckAllFirmwareReleaseResult,
    });

    await service.exitUpdateWorkflow();
    await service.trackUpdateTaskAttemptResult({
      workflowId,
      status: 'failed',
      error: new Error('late hardware cancellation'),
    });

    expect(attemptResultSpy).not.toHaveBeenCalled();
    expect(await service.getUpdateWorkflowTrackingInfo()).toEqual(
      expect.objectContaining({ retryCount: 0 }),
    );
  });

  it('increments retryCount only when retryUpdateTask starts', async () => {
    const service = new ServiceFirmwareUpdate({
      backgroundApi: {} as IBackgroundApi,
    });
    const workflowId = service.resetUpdateWorkflowTracking({
      updateFlow: 'v1',
      releaseResult: {
        updateInfos: {},
      } as ICheckAllFirmwareReleaseResult,
    });
    service.updateTasks[1] = {
      workflowId,
      fn: jest.fn(),
    };
    jest.spyOn(service, 'waitDeviceRestart').mockResolvedValue(undefined);
    jest.spyOn(service, 'runUpdateTask').mockResolvedValue(undefined);

    expect(await service.getUpdateWorkflowTrackingInfo()).toEqual(
      expect.objectContaining({ retryCount: 0 }),
    );

    await service.retryUpdateTask({
      id: 1,
      connectId: undefined,
      releaseResult: undefined,
    });

    expect(await service.getUpdateWorkflowTrackingInfo()).toEqual(
      expect.objectContaining({ retryCount: 1 }),
    );
    expect(hardwareUiStateCompletedAtom.set).toHaveBeenCalledWith(undefined);
  });

  it('does not wait for attempt analytics before exposing retry state', async () => {
    jest.mocked(firmwareUpdateWorkflowRunningAtom.get).mockResolvedValue(true);
    jest.mocked(firmwareUpdateRetryAtom.get).mockResolvedValue(undefined);
    const service = new ServiceFirmwareUpdate({
      backgroundApi: {
        serviceHardwareUI: {
          closeHardwareUiStateDialog: jest.fn(),
        },
        serviceSetting: {
          getHardwareTransportType: jest.fn(
            () => new Promise<EHardwareTransportType>(() => undefined),
          ),
        },
      } as unknown as IBackgroundApi,
    });
    const workflowId = service.resetUpdateWorkflowTracking({
      updateFlow: 'v1',
      releaseResult: {
        updateInfos: {},
      } as ICheckAllFirmwareReleaseResult,
    });
    service.updateTasks[1] = {
      workflowId,
      fn: jest.fn().mockRejectedValue(new Error('update failure')),
    };

    await service.runUpdateTask({ id: 1 });

    expect(firmwareUpdateRetryAtom.set).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1 }),
    );
  });
});
