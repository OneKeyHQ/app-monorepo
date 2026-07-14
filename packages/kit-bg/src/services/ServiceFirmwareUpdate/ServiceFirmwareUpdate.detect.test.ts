import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EHardwareTransportType } from '@onekeyhq/shared/types';
import {
  EHardwareVendor,
  type ICheckAllFirmwareReleaseResult,
} from '@onekeyhq/shared/types/device';

import localDb from '../../dbs/local/localDb';
import {
  firmwareUpdateRetryAtom,
  firmwareUpdateWorkflowRunningAtom,
} from '../../states/jotai/atoms';

import ServiceFirmwareUpdate from './ServiceFirmwareUpdate';

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
