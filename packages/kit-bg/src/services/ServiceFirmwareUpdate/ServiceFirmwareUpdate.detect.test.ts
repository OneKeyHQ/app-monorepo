import { EDeviceType } from '@onekeyfe/hd-shared';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EHardwareTransportType } from '@onekeyhq/shared/types';
import {
  EHardwareCallContext,
  EHardwareVendor,
  type IBleFirmwareReleasePayload,
  type IBootloaderReleasePayload,
  type ICheckAllFirmwareReleaseResult,
  type IFirmwareUpdateInfo,
  type IOneKeyDeviceFeatures,
} from '@onekeyhq/shared/types/device';

import localDb from '../../dbs/local/localDb';
import {
  firmwareUpdateRetryAtom,
  firmwareUpdateStepInfoAtom,
  firmwareUpdateWorkflowRunningAtom,
  hardwareUiStateCompletedAtom,
} from '../../states/jotai/atoms';

import { prepareProtocolV2ResourceFiles } from './protocolV2ResourceArchive';
import ServiceFirmwareUpdate, {
  buildPro2TargetsToUpdate,
  buildProtocolV2FirmwareVersionInfo,
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
    installing: 'installing',
    updateStart: 'updateStart',
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
    get: jest.fn().mockResolvedValue({
      step: 'updateStart',
      payload: { startAtTime: 1 },
    }),
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

jest.mock('./protocolV2ResourceArchive', () => ({
  prepareProtocolV2ResourceFiles: jest.fn(),
}));

const mockedLocalDb = jest.mocked(localDb);

describe('ServiceFirmwareUpdate firmware manifest refresh', () => {
  it('forces an App-managed manifest refresh before a release check', async () => {
    const checkAllFirmwareRelease = jest.fn().mockResolvedValue({
      success: true,
      payload: { features: {} },
    });
    const getSDKInstance = jest.fn().mockResolvedValue({
      checkAllFirmwareRelease,
    });
    const service = new ServiceFirmwareUpdate({
      backgroundApi: {
        serviceHardware: {
          getSDKInstance,
        },
        serviceSetting: {
          getHardwareTransportType: jest
            .fn()
            .mockResolvedValue(EHardwareTransportType.WEBUSB),
        },
      } as unknown as IBackgroundApi,
    });

    await service.baseCheckAllFirmwareRelease({
      connectId: 'device-1',
      firmwareType: undefined,
      skipChangeTransportType: true,
    });

    expect(getSDKInstance).toHaveBeenCalledWith({
      connectId: 'device-1',
      forceFirmwareManifestRefresh: true,
    });
    expect(checkAllFirmwareRelease).toHaveBeenCalledTimes(1);
  });
});

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

  it('skips OneKey update detection while the hardware channel is busy', async () => {
    mockedLocalDb.getDeviceByQuery.mockResolvedValue({
      id: 'db-device-1',
      connectId: 'ONEKEY_BLE_ID',
      vendor: EHardwareVendor.onekey,
    } as IDBDevice);
    const tryRunExclusiveOneKeyOperation = jest
      .fn()
      .mockResolvedValue({ acquired: false });
    const getCompatibleConnectId = jest.fn();
    const service = new ServiceFirmwareUpdate({
      backgroundApi: {
        serviceHardware: {
          getCompatibleConnectId,
        },
        serviceHardwareUI: {
          tryRunExclusiveOneKeyOperation,
        },
      } as unknown as IBackgroundApi,
    });

    await expect(
      service.detectActiveAccountFirmwareUpdates({
        connectId: 'ONEKEY_BLE_ID',
      }),
    ).resolves.toEqual({
      status: 'busy',
      retryAfterMs: 5000,
    });

    expect(tryRunExclusiveOneKeyOperation).toHaveBeenCalledWith(
      expect.any(Function),
      { deviceKey: 'db-device-1' },
    );
    expect(getCompatibleConnectId).not.toHaveBeenCalled();
  });

  it('returns the remaining throttle delay after the hardware channel becomes idle', async () => {
    mockedLocalDb.getDeviceByQuery.mockResolvedValue({
      id: 'db-device-1',
      connectId: 'ONEKEY_BLE_ID',
      vendor: EHardwareVendor.onekey,
    } as IDBDevice);
    const getCompatibleConnectId = jest.fn();
    const tryRunExclusiveOneKeyOperation = jest.fn(
      async (operation: () => Promise<unknown>) => ({
        acquired: true as const,
        result: await operation(),
      }),
    );
    const service = new ServiceFirmwareUpdate({
      backgroundApi: {
        serviceHardware: {
          getCompatibleConnectId,
        },
        serviceHardwareUI: {
          tryRunExclusiveOneKeyOperation,
        },
        serviceFirmwareUpdate: {
          showAutoUpdateCheckDebugToast: jest.fn(),
        },
      } as unknown as IBackgroundApi,
    });

    const result = await service.detectActiveAccountFirmwareUpdates({
      connectId: 'ONEKEY_BLE_ID',
    });

    expect(result.status).toBe('throttled');
    if (result.status === 'throttled') {
      expect(result.retryAfterMs).toBeGreaterThan(0);
      expect(result.retryAfterMs).toBeLessThanOrEqual(60_000);
    }
    expect(tryRunExclusiveOneKeyOperation).toHaveBeenCalledWith(
      expect.any(Function),
      { deviceKey: 'db-device-1' },
    );
    expect(getCompatibleConnectId).not.toHaveBeenCalled();
  });

  it('runs OneKey SDK detection only while holding the hardware lease', async () => {
    mockedLocalDb.getDeviceByQuery.mockResolvedValue({
      id: 'db-device-1',
      connectId: 'ONEKEY_BLE_ID',
      vendor: EHardwareVendor.onekey,
    } as IDBDevice);
    let leaseActive = false;
    const getCompatibleConnectId = jest.fn(async () => {
      expect(leaseActive).toBe(true);
      return 'ONEKEY_COMPATIBLE_ID';
    });
    const tryRunExclusiveOneKeyOperation = jest.fn(
      async (operation: () => Promise<unknown>) => {
        leaseActive = true;
        try {
          return {
            acquired: true as const,
            result: await operation(),
          };
        } finally {
          leaseActive = false;
        }
      },
    );
    const service = new ServiceFirmwareUpdate({
      backgroundApi: {
        serviceHardware: {
          getCompatibleConnectId,
        },
        serviceHardwareUI: {
          tryRunExclusiveOneKeyOperation,
        },
        serviceFirmwareUpdate: {
          showAutoUpdateCheckDebugToast: jest.fn(),
        },
      } as unknown as IBackgroundApi,
    });
    service.detectMap.firstDetectAt =
      Date.now() - timerUtils.getTimeDurationMs({ minute: 2 });
    jest
      .spyOn(service, 'checkDeviceIsBootloaderMode')
      .mockImplementation(async () => {
        expect(leaseActive).toBe(true);
        return {
          isBootloaderMode: false,
          features: undefined,
          error: undefined,
        };
      });

    await expect(
      service.detectActiveAccountFirmwareUpdates({
        connectId: 'ONEKEY_BLE_ID',
      }),
    ).resolves.toEqual({ status: 'finished' });

    expect(getCompatibleConnectId).toHaveBeenCalledWith({
      hardwareCallContext: EHardwareCallContext.BACKGROUND_TASK,
      connectId: 'ONEKEY_BLE_ID',
    });
    expect(leaseActive).toBe(false);
  });
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

  it('merges and deduplicates developer force targets after SDK targets', () => {
    expect(
      buildPro2TargetsToUpdate({
        sdkTargets: ['app_v1', 'resource'],
        forceTargets: ['resource', 'se01'],
      }),
    ).toEqual(['app_v1', 'resource', 'se01']);
  });
});

describe('buildProtocolV2FirmwareVersionInfo', () => {
  const releaseInfo = {
    currentVersions: {
      firmware: '1.0.0',
      applicationP1: '1.0.0',
      applicationP2: '1.0.0',
      bootloader: '1.0.0',
      board: '1.0.0',
      ble: '1.0.20',
    },
    components: [
      {
        configKey: 'application_p1',
        componentTarget: 'APPLICATION_P1',
        updateTarget: 'app_v1',
        currentVersion: '1.0.0',
        targetVersion: '1.1.0',
        status: 'outdated',
        required: false,
      },
      {
        configKey: 'coprocessor',
        componentTarget: 'COPROCESSOR',
        updateTarget: 'coprocessor',
        currentVersion: '1.0.20',
        targetVersion: '1.0.21',
        status: 'outdated',
        required: false,
      },
    ],
    release: {
      version: [1, 1, 0],
    },
  } as unknown as Parameters<
    typeof buildProtocolV2FirmwareVersionInfo
  >[0]['releaseInfo'];

  it('keeps SafeOS first-level versions and selected component versions', () => {
    expect(
      buildProtocolV2FirmwareVersionInfo({
        releaseInfo,
        targetsToUpdate: ['app_v1', 'coprocessor', 'resource'],
      }),
    ).toEqual({
      safeOS: {
        currentVersion: '1.0.0',
        targetVersion: '1.1.0',
      },
      components: [
        {
          target: 'app_v1',
          currentVersion: '1.0.0',
          targetVersion: '1.1.0',
        },
        {
          target: 'coprocessor',
          currentVersion: '1.0.20',
          targetVersion: '1.0.21',
        },
      ],
    });
  });

  it('shows the current SafeOS version without an update transition for resources', () => {
    expect(
      buildProtocolV2FirmwareVersionInfo({
        releaseInfo,
        targetsToUpdate: ['resource'],
      }),
    ).toEqual({
      safeOS: {
        currentVersion: '1.0.0',
        targetVersion: null,
      },
      components: [],
    });
  });
});

describe('ServiceFirmwareUpdate Protocol V2 version mapping', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('prefers the SDK device-state BLE version over legacy features', async () => {
    jest.spyOn(deviceUtils, 'getDeviceVersion').mockResolvedValue({
      bleVersion: '1.0.0',
      firmwareVersion: '',
      bootloaderVersion: '',
    });
    const service = new ServiceFirmwareUpdate({
      backgroundApi: {
        serviceHardware: {
          getConnectIdFromFeatures: jest.fn().mockResolvedValue(undefined),
        },
      } as unknown as IBackgroundApi,
    });

    const result = await service.checkBLEFirmwareRelease({
      connectId: undefined,
      features: {} as IOneKeyDeviceFeatures,
      bleReleasePayload: {
        status: 'outdated',
        shouldUpdate: true,
        release: { version: [2, 0, 0] },
      } as unknown as IBleFirmwareReleasePayload,
      forceUpdate: false,
      currentVersion: '1.5.0',
    });

    expect(result).toEqual(
      expect.objectContaining({
        hasUpgrade: true,
        fromVersion: '1.5.0',
        toVersion: '2.0.0',
      }),
    );
  });

  it('reads a Protocol V2 bootloader component version directly', async () => {
    jest.spyOn(deviceUtils, 'getDeviceVersion').mockResolvedValue({
      bleVersion: '',
      firmwareVersion: '',
      bootloaderVersion: '1.0.0',
    });
    const service = new ServiceFirmwareUpdate({
      backgroundApi: {} as IBackgroundApi,
    });

    const result = await service.checkBootloaderRelease({
      connectId: undefined,
      features: {} as IOneKeyDeviceFeatures,
      firmwareUpdateInfo: {
        releasePayload: { release: undefined },
      } as unknown as IFirmwareUpdateInfo,
      bootloaderReleasePayload: {
        status: 'outdated',
        shouldUpdate: true,
        release: { version: [2, 0, 0] },
      } as unknown as IBootloaderReleasePayload,
      forceUpdate: false,
      currentVersion: '1.5.0',
    });

    expect(result).toEqual(
      expect.objectContaining({
        hasUpgrade: true,
        fromVersion: '1.5.0',
        toVersion: '2.0.0',
      }),
    );
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
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps an SDK-selected resource target on the incremental inventory path', async () => {
    const firmwareUpdateV4 = jest.fn().mockResolvedValue({
      success: true,
      payload: {},
    });
    const resourceFiles = [
      {
        binary: new Uint8Array([1]).buffer,
        devicePath: 'vol0:/bundles/images/images.okpkg',
        size: 1,
        fileHash: 'a'.repeat(64),
      },
    ];
    jest
      .mocked(prepareProtocolV2ResourceFiles)
      .mockResolvedValue(resourceFiles);
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

    await service.updatingFirmwareV4({
      connectId: 'PRO2_CONNECT_ID',
      bleVersion: undefined,
      firmwareVersion: undefined,
      bootloaderVersion: undefined,
      firmwareType: undefined,
      isPro2Device: true,
      pro2TargetsToUpdate: ['resource'],
      pro2ResourceArchive: {
        archiveUrl: 'https://example.com/releases/pro2/resource.zip',
        archiveSha256: 'a'.repeat(64),
        archiveSize: 1024,
      },
      requirePreparedArtifacts: false,
      targetsToUpdate: ['resource'],
    });

    expect(firmwareUpdateV4).toHaveBeenCalledTimes(1);
    expect(firmwareUpdateV4.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        forcedUpdateRes: false,
        resourceFiles,
        targetsToUpdate: ['resource'],
      }),
    );
    expect(prepareProtocolV2ResourceFiles).toHaveBeenCalledWith({
      hardwareSDK,
      archive: {
        archiveUrl: 'https://example.com/releases/pro2/resource.zip',
        archiveSha256: 'a'.repeat(64),
        archiveSize: 1024,
      },
      targetsToUpdate: ['resource'],
    });
    expect(firmwareUpdateStepInfoAtom.set).toHaveBeenNthCalledWith(1, {
      step: 'updateStart',
      payload: {
        startAtTime: 1,
        isDownloadingArtifacts: true,
      },
    });
    expect(
      jest.mocked(firmwareUpdateStepInfoAtom.set).mock.invocationCallOrder[0],
    ).toBeLessThan(
      jest.mocked(prepareProtocolV2ResourceFiles).mock.invocationCallOrder[0],
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
        // The persisted value may be stale; the active connection is authoritative.
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

    await service.updatingFirmwareV4({
      connectId: bleConnectId,
      bleVersion: undefined,
      firmwareVersion: undefined,
      bootloaderVersion: undefined,
      firmwareType: undefined,
      isPro2Device: true,
      pro2TargetsToUpdate: ['app_v1'],
      requirePreparedArtifacts: false,
      targetsToUpdate: ['app_v1'],
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

describe('ServiceFirmwareUpdate legacy workflow running state', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sets the background guard before entering hardware processing', async () => {
    jest.clearAllMocks();
    mockedLocalDb.getDeviceByQuery.mockResolvedValue(undefined);
    const withHardwareProcessing = jest
      .fn()
      .mockRejectedValue(new Error('hardware processing unavailable'));
    const service = new ServiceFirmwareUpdate({
      backgroundApi: {
        serviceHardwareUI: {
          withHardwareProcessing,
        },
      } as unknown as IBackgroundApi,
    });

    await expect(
      service.startUpdateWorkflow({
        releaseResult: {
          updateInfos: {},
        },
      } as never),
    ).rejects.toThrow('hardware processing unavailable');

    expect(firmwareUpdateWorkflowRunningAtom.set).toHaveBeenCalledWith(true);
    expect(
      jest.mocked(firmwareUpdateWorkflowRunningAtom.set).mock
        .invocationCallOrder[0],
    ).toBeLessThan(withHardwareProcessing.mock.invocationCallOrder[0]);
    expect(firmwareUpdateWorkflowRunningAtom.set).toHaveBeenLastCalledWith(
      false,
    );
  });

  it('clears the background guard when transport initialization fails', async () => {
    jest.clearAllMocks();
    mockedLocalDb.getDeviceByQuery.mockResolvedValue(undefined);
    const waitSpy = jest.spyOn(timerUtils, 'wait').mockResolvedValue(undefined);
    const clearForceTransportType = jest.fn().mockResolvedValue(undefined);
    const withHardwareProcessing = jest.fn(
      async (callback: () => Promise<void>) => callback(),
    );
    const service = new ServiceFirmwareUpdate({
      backgroundApi: {
        serviceHardwareUI: {
          withHardwareProcessing,
        },
        serviceHardware: {
          getCurrentTransportType: jest
            .fn()
            .mockRejectedValue(new Error('transport unavailable')),
          clearForceTransportType,
        },
      } as unknown as IBackgroundApi,
    });

    await expect(
      service.startUpdateWorkflow({
        releaseResult: {
          updateInfos: {},
        },
      } as never),
    ).rejects.toThrow('transport unavailable');

    expect(clearForceTransportType).toHaveBeenCalledTimes(1);
    expect(firmwareUpdateWorkflowRunningAtom.set).toHaveBeenNthCalledWith(
      1,
      true,
    );
    expect(firmwareUpdateWorkflowRunningAtom.set).toHaveBeenLastCalledWith(
      false,
    );
    expect(waitSpy).toHaveBeenCalledTimes(1);
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

describe('ServiceFirmwareUpdate legacy Pro firmware fallback', () => {
  const createService = () =>
    new ServiceFirmwareUpdate({
      backgroundApi: {} as IBackgroundApi,
    });

  test('keeps Pro on the existing V3 path when no prepared Plan exists', async () => {
    const service = createService();
    const updatingFirmwareV3 = jest
      .spyOn(service, 'updatingFirmwareV3')
      .mockResolvedValue({ message: 'ok' });
    const runtimeHost = jest.spyOn(
      service as unknown as {
        getFirmwareUpdateRuntimeHost: () => Promise<unknown>;
      },
      'getFirmwareUpdateRuntimeHost',
    );
    jest
      .spyOn(service, 'createRunTaskWithRetry')
      .mockImplementation(async ({ fn }) => fn({ id: 1 }));

    await service.startUpdateFirmwareTaskForNewBootVersion({
      backuped: true,
      usbConnected: true,
      releaseResult: {
        deviceType: EDeviceType.Pro,
        updateInfos: {},
      } as ICheckAllFirmwareReleaseResult,
    });

    expect(updatingFirmwareV3).toHaveBeenCalledTimes(1);
    expect(runtimeHost).not.toHaveBeenCalled();
  });

  test('routes Protocol V2 devices without a Plan through the archive V4 path', async () => {
    const service = createService();
    const updatingFirmwareV4 = jest
      .spyOn(service, 'updatingFirmwareV4')
      .mockResolvedValue({ message: 'ok' });
    jest
      .spyOn(service, 'createRunTaskWithRetry')
      .mockImplementation(async ({ fn }) => fn({ id: 1 }));

    await service.startUpdateFirmwareTaskForNewBootVersion({
      backuped: true,
      usbConnected: true,
      releaseResult: {
        deviceType: EDeviceType.Pro2,
        pro2TargetsToUpdate: ['boot', 'app_v1', 'resource'],
        pro2ResourceArchive: {
          archiveUrl: 'https://example.com/releases/pro2/resource.zip',
          archiveSha256: 'a'.repeat(64),
          archiveSize: 1024,
        },
        updateInfos: {},
      } as ICheckAllFirmwareReleaseResult,
    });

    expect(updatingFirmwareV4).toHaveBeenCalledWith(
      expect.objectContaining({
        requirePreparedArtifacts: false,
        targetsToUpdate: ['boot', 'app_v1', 'resource'],
        pro2ResourceArchive: {
          archiveUrl: 'https://example.com/releases/pro2/resource.zip',
          archiveSha256: 'a'.repeat(64),
          archiveSize: 1024,
        },
      }),
      undefined,
    );
  });

  test('rejects invalid Protocol V2 targets even when no Plan exists', async () => {
    const service = createService();
    const updatingFirmwareV4 = jest.spyOn(service, 'updatingFirmwareV4');
    const createRunTaskWithRetry = jest.spyOn(
      service,
      'createRunTaskWithRetry',
    );

    await expect(
      service.startUpdateFirmwareTaskForNewBootVersion({
        backuped: true,
        usbConnected: true,
        releaseResult: {
          deviceType: EDeviceType.Pro2,
          pro2TargetsToUpdate: ['app_v1', 'invalid-target'],
          updateInfos: {},
        } as unknown as ICheckAllFirmwareReleaseResult,
      }),
    ).rejects.toThrow(
      'Protocol V2 firmware update plan contains an invalid target',
    );

    expect(createRunTaskWithRetry).not.toHaveBeenCalled();
    expect(updatingFirmwareV4).not.toHaveBeenCalled();
  });

  test('requires App-prepared artifacts whenever the Pro2 Plan is present', async () => {
    const service = createService();
    const plan = {
      executor: 'v4',
      targetsToUpdate: ['boot', 'app_v1'],
    };
    jest
      .spyOn(
        service as unknown as {
          getFirmwareUpdateRuntimeHost: () => Promise<unknown>;
        },
        'getFirmwareUpdateRuntimeHost',
      )
      .mockResolvedValue({
        artifacts: {
          getPlan: jest.fn(() => plan),
        },
      });
    jest
      .spyOn(service, 'createRunTaskWithRetry')
      .mockImplementation(async ({ fn }) => fn({ id: 1 }));
    const updatingFirmwareV4 = jest
      .spyOn(service, 'updatingFirmwareV4')
      .mockResolvedValue({ message: 'ok' });

    await service.startUpdateFirmwareTaskForNewBootVersion({
      backuped: true,
      usbConnected: true,
      releaseResult: {
        deviceType: EDeviceType.Pro2,
        firmwareUpdatePlanDigest: 'c'.repeat(64),
        updateInfos: {},
      } as ICheckAllFirmwareReleaseResult,
    });

    expect(updatingFirmwareV4).toHaveBeenCalledWith(
      expect.objectContaining({
        requirePreparedArtifacts: true,
        targetsToUpdate: ['boot', 'app_v1'],
      }),
      undefined,
    );
  });
});
