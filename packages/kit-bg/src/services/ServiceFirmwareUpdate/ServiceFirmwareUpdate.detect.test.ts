import {
  EDeviceType,
  EFirmwareType,
  HardwareErrorCode,
} from '@onekeyfe/hd-shared';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { CoreSDKLoader } from '@onekeyhq/shared/src/hardware/instance';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EHardwareTransportType } from '@onekeyhq/shared/types';
import {
  EHardwareCallContext,
  EHardwareVendor,
  type IBleFirmwareReleasePayload,
  type IBleFirmwareUpdateInfo,
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
  firmwareUpdatesDetectStatusPersistAtom,
  hardwareUiStateAtom,
  hardwareUiStateCompletedAtom,
} from '../../states/jotai/atoms';

import ServiceFirmwareUpdate, {
  buildPro2TargetsToUpdate,
  buildProtocolV2FirmwareVersionInfo,
  buildProtocolV2PlanForceTargets,
  shouldForceProtocolV2ResourceUpdate,
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
    FirmwareUpdateDetectStatusChanged: 'FirmwareUpdateDetectStatusChanged',
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
    getAllDevices: jest.fn(),
    getDeviceByQuery: jest.fn(),
  },
}));

jest.mock('../../states/jotai/atoms', () => ({
  EFirmwareUpdateSteps: {
    init: 'init',
    installing: 'installing',
    updateStart: 'updateStart',
  },
  // The real enum: the service builds its skipped/dialog event sets at
  // module scope, so an empty stub collapses both into Set{undefined}
  // and every event-routing assertion below stops proving anything.
  EHardwareUiStateAction: jest.requireActual(
    '@onekeyhq/shared/types/hardwareUi',
  ).EHardwareUiStateAction,
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
    get: jest.fn(),
    set: jest.fn(),
  },
  hardwareUiStateCompletedAtom: {
    get: jest.fn(),
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
      protocolV2ForceUpdateTargets: ['app_v1', 'coprocessor'],
    });

    expect(getSDKInstance).toHaveBeenCalledWith({
      connectId: 'device-1',
      forceFirmwareManifestRefresh: true,
    });
    expect(checkAllFirmwareRelease).toHaveBeenCalledTimes(1);
    expect(checkAllFirmwareRelease).toHaveBeenCalledWith(
      'device-1',
      expect.objectContaining({
        protocolV2ForceUpdateTargets: ['app_v1', 'coprocessor'],
      }),
    );
  });

  it('uses the cached manifest path for a background release check', async () => {
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
      forceFirmwareManifestRefresh: false,
    });

    expect(getSDKInstance).toHaveBeenCalledWith({
      connectId: 'device-1',
    });
  });
});

describe('ServiceFirmwareUpdate.detectActiveAccountFirmwareUpdates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reads a live firmware state before comparing update versions', async () => {
    const getDeviceState = jest.fn().mockResolvedValue({
      schemaVersion: 1,
      protocol: 'V1',
      protocolVersion: 1,
      revision: 2,
      updatedAt: 2,
      identity: {
        deviceType: EDeviceType.Pro,
        serialNo: 'DEVICE_USB',
      },
      status: {
        mode: 'normal',
      },
      settings: {},
      versions: {
        firmware: '4.21.0',
        ble: '2.3.7',
        bootloader: '2.8.4',
      },
      capabilities: [],
    });
    const service = new ServiceFirmwareUpdate({
      backgroundApi: {
        serviceHardware: {
          getDeviceState,
        },
      } as unknown as IBackgroundApi,
    });

    await expect(
      service.checkDeviceIsBootloaderMode({
        connectId: 'DEVICE_USB',
      }),
    ).resolves.toMatchObject({
      isBootloaderMode: false,
      features: {
        onekey_firmware_version: '4.21.0',
        onekey_ble_version: '2.3.7',
        onekey_boot_version: '2.8.4',
      },
    });
    expect(getDeviceState).toHaveBeenCalledWith({
      connectId: 'DEVICE_USB',
      params: {
        scope: 'firmware',
        retryCount: 0,
        skipWebDevicePrompt: true,
      },
      silentMode: true,
    });
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
          deviceStageBurst: { silenceForFirmwareWorkflow: jest.fn() },
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
      {
        deviceKey: 'db-device-1',
      },
    );
    expect(getCompatibleConnectId).not.toHaveBeenCalled();
  });

  it('uses the DB connectId for throttling after transport resolution', async () => {
    mockedLocalDb.getDeviceByQuery.mockResolvedValue({
      id: 'db-device-1',
      connectId: 'ONEKEY_USB_ID',
      usbConnectId: 'ONEKEY_USB_ID',
      bleConnectId: 'ONEKEY_BLE_ID',
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
          deviceStageBurst: { silenceForFirmwareWorkflow: jest.fn() },
          tryRunExclusiveOneKeyOperation,
        },
        serviceFirmwareUpdate: {
          showAutoUpdateCheckDebugToast: jest.fn(),
        },
      } as unknown as IBackgroundApi,
    });
    service.detectMap.firstDetectAt =
      Date.now() - timerUtils.getTimeDurationMs({ minute: 2 });
    service.detectMap.detectMapCache.ONEKEY_USB_ID = {
      lastDetectAt: Date.now(),
    };

    const result = await service.detectActiveAccountFirmwareUpdates({
      connectId: 'ONEKEY_BLE_ID',
    });

    expect(result.status).toBe('throttled');
    if (result.status === 'throttled') {
      expect(result.retryAfterMs).toBeGreaterThan(0);
      expect(result.retryAfterMs).toBeLessThanOrEqual(5 * 60_000);
    }
    expect(tryRunExclusiveOneKeyOperation).toHaveBeenCalledWith(
      expect.any(Function),
      {
        deviceKey: 'db-device-1',
      },
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
          deviceStageBurst: { silenceForFirmwareWorkflow: jest.fn() },
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
          features: {} as IOneKeyDeviceFeatures,
          error: undefined,
        };
      });
    jest
      .spyOn(deviceUtils, 'getFirmwareType')
      .mockResolvedValue(EFirmwareType.Universal);
    jest
      .spyOn(deviceUtils, 'getDeviceTypeFromFeatures')
      .mockResolvedValue(EDeviceType.Pro2);
    const baseCheckAllFirmwareRelease = jest
      .spyOn(service, 'baseCheckAllFirmwareRelease')
      .mockImplementation(async () => {
        expect(leaseActive).toBe(true);
        return {
          firmware: {},
          ble: {},
          currentVersions: { ble: '2.3.7' },
          targetsToUpdate: ['resource'],
        } as never;
      });
    const checkFirmwareRelease = jest
      .spyOn(service, 'checkFirmwareRelease')
      .mockImplementation(async () => {
        expect(leaseActive).toBe(true);
        return { hasUpgrade: false } as IFirmwareUpdateInfo;
      });
    const checkBLEFirmwareRelease = jest
      .spyOn(service, 'checkBLEFirmwareRelease')
      .mockImplementation(async () => {
        expect(leaseActive).toBe(true);
        return { hasUpgrade: false } as IBleFirmwareUpdateInfo;
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
    expect(baseCheckAllFirmwareRelease).toHaveBeenCalledWith({
      connectId: 'ONEKEY_COMPATIBLE_ID',
      firmwareType: EFirmwareType.Universal,
      forceFirmwareManifestRefresh: false,
      retryCount: 0,
      silentMode: true,
      skipChangeTransportType: true,
    });
    expect(checkFirmwareRelease).toHaveBeenCalledTimes(1);
    expect(checkFirmwareRelease).toHaveBeenCalledWith(
      expect.objectContaining({ saveUpdateInfo: false }),
    );
    expect(checkBLEFirmwareRelease).toHaveBeenCalledTimes(1);
    expect(checkBLEFirmwareRelease).toHaveBeenCalledWith(
      expect.objectContaining({ saveUpdateInfo: false }),
    );
    expect(
      service.detectMap.detectMapCache.ONEKEY_BLE_ID?.updateInfo
        ?.targetsToUpdate,
    ).toEqual(['resource']);
    expect(
      service.detectMap.getDetectStatus({ connectId: 'ONEKEY_BLE_ID' }),
    ).toEqual(
      expect.objectContaining({
        resolved: true,
        status: expect.objectContaining({ hasUpgrade: true }),
      }),
    );
    expect(leaseActive).toBe(false);
  });

  it('does not consume the throttle when the release check fails', async () => {
    mockedLocalDb.getDeviceByQuery.mockResolvedValue({
      id: 'db-device-1',
      connectId: 'ONEKEY_USB_ID',
      vendor: EHardwareVendor.onekey,
    } as IDBDevice);
    const service = new ServiceFirmwareUpdate({
      backgroundApi: {
        serviceHardware: {
          getCompatibleConnectId: jest.fn().mockResolvedValue('ONEKEY_USB_ID'),
        },
        serviceHardwareUI: {
          deviceStageBurst: { silenceForFirmwareWorkflow: jest.fn() },
          tryRunExclusiveOneKeyOperation: jest.fn(
            async (operation: () => Promise<unknown>) => ({
              acquired: true as const,
              result: await operation(),
            }),
          ),
        },
        serviceFirmwareUpdate: {
          showAutoUpdateCheckDebugToast: jest.fn(),
        },
      } as unknown as IBackgroundApi,
    });
    service.detectMap.firstDetectAt =
      Date.now() - timerUtils.getTimeDurationMs({ minute: 2 });
    jest.spyOn(service, 'checkDeviceIsBootloaderMode').mockResolvedValue({
      isBootloaderMode: false,
      features: {} as IOneKeyDeviceFeatures,
      error: undefined,
    });
    jest
      .spyOn(deviceUtils, 'getFirmwareType')
      .mockResolvedValue(EFirmwareType.Universal);
    jest
      .spyOn(service, 'baseCheckAllFirmwareRelease')
      .mockRejectedValue(new Error('Release request failed'));

    await expect(
      service.detectActiveAccountFirmwareUpdates({
        connectId: 'ONEKEY_USB_ID',
      }),
    ).resolves.toEqual({ status: 'failed', retryAfterMs: 5000 });

    expect(
      service.detectMap.detectMapCache.ONEKEY_USB_ID?.lastDetectAt,
    ).toBeUndefined();
  });
});

describe('ServiceFirmwareUpdate Protocol V2 target-only checks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.mocked(CoreSDKLoader).mockReset();
    jest.restoreAllMocks();
  });

  it('keeps a target-only update after the full release check', async () => {
    const features = {} as IOneKeyDeviceFeatures;
    mockedLocalDb.getDeviceByQuery.mockResolvedValue({
      id: 'db-device-1',
      connectId: 'PRO2_USB_ID',
      vendor: EHardwareVendor.onekey,
    } as IDBDevice);
    jest.mocked(CoreSDKLoader).mockResolvedValue({
      getDeviceSerialNo: jest.fn().mockReturnValue('PRO2_SERIAL'),
    } as never);

    const service = new ServiceFirmwareUpdate({
      backgroundApi: {
        serviceDevSetting: {
          getFirmwareUpdateDevSettings: jest.fn().mockResolvedValue(undefined),
          getFirmwareUpdateDevSettingsSnapshot: jest
            .fn()
            .mockResolvedValue(undefined),
        },
        serviceHardware: {
          getSDKInstance: jest.fn().mockResolvedValue({
            cancel: jest.fn(),
          }),
          hardwareVerifyManager: {
            fetchFirmwareVerifyHash: jest.fn().mockResolvedValue(undefined),
          },
        },
        serviceHardwareUI: {
          deviceStageBurst: { silenceForFirmwareWorkflow: jest.fn() },
          closeHardwareUiStateDialog: jest.fn(),
        },
      } as unknown as IBackgroundApi,
    });
    jest.spyOn(service, 'checkDeviceIsBootloaderMode').mockResolvedValue({
      isBootloaderMode: false,
      features,
      error: undefined,
    });
    jest
      .spyOn(deviceUtils, 'getDeviceTypeFromFeatures')
      .mockResolvedValue(EDeviceType.Pro2);
    jest
      .spyOn(deviceUtils, 'getFirmwareType')
      .mockResolvedValue(EFirmwareType.Universal);
    jest
      .spyOn(deviceUtils, 'buildDeviceName')
      .mockResolvedValue('OneKey Pro 2');
    jest
      .spyOn(deviceUtils, 'buildDeviceBleName')
      .mockReturnValue('OneKey Pro 2');
    jest
      .spyOn(deviceUtils, 'getDeviceModeFromFeatures')
      .mockResolvedValue('normal' as never);
    jest
      .spyOn(deviceUtils, 'getFixedUpdatingConnectId')
      .mockReturnValue('PRO2_USB_ID');
    jest
      .spyOn(
        service as unknown as {
          loadBaseFirmwareRelease: () => Promise<unknown>;
        },
        'loadBaseFirmwareRelease',
      )
      .mockResolvedValue({
        features,
        firmware: {},
        ble: {},
        currentVersions: {
          firmware: '1.0.0',
          ble: '1.0.0',
        },
        targetsToUpdate: ['resource'],
      });
    jest.spyOn(service, 'checkFirmwareRelease').mockResolvedValue({
      hasUpgrade: false,
    } as IFirmwareUpdateInfo);
    jest.spyOn(service, 'checkBLEFirmwareRelease').mockResolvedValue({
      hasUpgrade: false,
    } as IBleFirmwareUpdateInfo);
    jest
      .spyOn(
        service as unknown as {
          getFirmwareUpdateRuntimeHost: () => Promise<unknown>;
        },
        'getFirmwareUpdateRuntimeHost',
      )
      .mockResolvedValue({
        artifacts: {
          cachePlanDigestIfPreparedSupported: jest
            .fn()
            .mockResolvedValue(undefined),
        },
      });

    const result = await service.checkAllFirmwareRelease({
      connectId: 'PRO2_USB_ID',
      firmwareType: undefined,
      skipCancel: true,
      resolvedTransportType: EHardwareTransportType.WEBUSB,
    });

    expect(result).toMatchObject({
      hasUpgrade: true,
      pro2TargetsToUpdate: ['resource'],
    });
    expect(
      service.detectMap.getDetectStatus({ connectId: 'PRO2_USB_ID' }),
    ).toEqual(
      expect.objectContaining({
        resolved: true,
        status: expect.objectContaining({ hasUpgrade: true }),
      }),
    );
  });
});

describe('ServiceFirmwareUpdate firmware detect status', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedLocalDb.getDeviceByQuery.mockResolvedValue(undefined);
  });

  it('does not treat throttling metadata as a resolved no-update result', async () => {
    const service = new ServiceFirmwareUpdate({
      backgroundApi: {} as IBackgroundApi,
    });
    service.detectMap.detectMapCache.DEVICE_USB = {
      lastDetectAt: Date.now(),
      updateInfo: undefined,
    };

    await expect(
      service.getFirmwareUpdateDetectStatus({ connectId: 'DEVICE_USB' }),
    ).resolves.toEqual({
      requestedConnectId: 'DEVICE_USB',
      resolved: false,
      status: undefined,
    });
  });

  it('clears the canonical DB status when given a transport connectId', async () => {
    mockedLocalDb.getDeviceByQuery.mockResolvedValue({
      id: 'db-device-1',
      connectId: 'DEVICE_USB',
      usbConnectId: 'DEVICE_USB',
      bleConnectId: 'DEVICE_BLE',
    } as IDBDevice);
    const service = new ServiceFirmwareUpdate({
      backgroundApi: {} as IBackgroundApi,
    });
    const deleteUpdateInfo = jest
      .spyOn(service.detectMap, 'deleteUpdateInfo')
      .mockResolvedValue(undefined);

    await (
      service as unknown as {
        deleteFirmwareUpdateDetectInfo: (connectId: string) => Promise<void>;
      }
    ).deleteFirmwareUpdateDetectInfo('DEVICE_BLE');

    expect(deleteUpdateInfo).toHaveBeenCalledWith({
      connectId: 'DEVICE_USB',
      usbConnectId: 'DEVICE_USB',
      bleConnectId: 'DEVICE_BLE',
    });
  });

  it('removes a previous transport key when resolving the canonical key', async () => {
    const service = new ServiceFirmwareUpdate({
      backgroundApi: {} as IBackgroundApi,
    });
    service.detectMap.detectMapCache.DEVICE_USB = {
      detectResultResolved: true,
      updateInfo: {
        firmware: {
          connectId: 'DEVICE_USB',
          hasUpgrade: true,
          hasUpgradeForce: false,
          fromVersion: '4.21.0',
          toVersion: '4.22.0',
          firmwareType: 'firmware',
        } as IFirmwareUpdateInfo,
      },
    };

    await service.detectMap.resolveUpdateInfo({
      connectId: 'DEVICE_BLE',
      usbConnectId: 'DEVICE_USB',
      bleConnectId: 'DEVICE_BLE',
    });

    expect(service.detectMap.detectMapCache.DEVICE_USB).toBeUndefined();
    expect(service.detectMap.detectMapCache.DEVICE_BLE).toMatchObject({
      detectResultResolved: true,
      updateInfo: undefined,
    });
    const updater = jest.mocked(firmwareUpdatesDetectStatusPersistAtom.set).mock
      .calls[0][0] as (value: unknown) => unknown;
    expect(
      updater({
        DEVICE_USB: { connectId: 'DEVICE_USB', hasUpgrade: true },
        DEVICE_BLE: { connectId: 'DEVICE_BLE', hasUpgrade: true },
      }),
    ).toBeUndefined();
  });

  it('returns the canonical bg update for a transport connectId', async () => {
    mockedLocalDb.getDeviceByQuery.mockResolvedValue({
      id: 'db-device-1',
      connectId: 'DEVICE_USB',
      usbConnectId: 'DEVICE_USB',
      bleConnectId: 'DEVICE_BLE',
    } as IDBDevice);
    const service = new ServiceFirmwareUpdate({
      backgroundApi: {} as IBackgroundApi,
    });
    service.detectMap.detectMapCache.DEVICE_USB = {
      detectResultResolved: true,
      updateInfo: {
        firmware: {
          connectId: 'DEVICE_USB',
          hasUpgrade: true,
          hasUpgradeForce: false,
          fromVersion: '4.21.0',
          toVersion: '4.22.0',
          firmwareType: 'firmware',
        } as IFirmwareUpdateInfo,
      },
    };

    await expect(
      service.getFirmwareUpdateDetectStatus({ connectId: 'DEVICE_BLE' }),
    ).resolves.toEqual({
      requestedConnectId: 'DEVICE_BLE',
      resolved: true,
      status: {
        connectId: 'DEVICE_USB',
        hasUpgrade: true,
        toVersion: '4.22.0',
        toFirmwareType: undefined,
        toVersionBle: undefined,
      },
    });
  });

  it('clears only the persisted update entry for the requested connectId', async () => {
    const service = new ServiceFirmwareUpdate({
      backgroundApi: {} as IBackgroundApi,
    });
    service.detectMap.detectMapCache.DEVICE_USB = {
      lastDetectAt: Date.now(),
    };

    await service.detectMap.deleteUpdateInfo({
      connectId: 'DEVICE_USB',
    });

    expect(service.detectMap.detectMapCache.DEVICE_USB).toMatchObject({
      detectResultResolved: true,
      updateInfo: undefined,
    });
    expect(
      service.detectMap.getDetectStatus({
        connectId: 'DEVICE_USB',
      }),
    ).toEqual({
      requestedConnectId: 'DEVICE_USB',
      resolved: true,
      status: undefined,
    });

    const updater = jest.mocked(firmwareUpdatesDetectStatusPersistAtom.set).mock
      .calls[0][0] as (value: unknown) => unknown;
    expect(
      updater({
        DEVICE_USB: { connectId: 'DEVICE_USB', hasUpgrade: true },
        OTHER_DEVICE: { connectId: 'OTHER_DEVICE', hasUpgrade: true },
      }),
    ).toEqual({
      OTHER_DEVICE: { connectId: 'OTHER_DEVICE', hasUpgrade: true },
    });
  });

  it('replaces the persisted update for the requested connectId', async () => {
    const service = new ServiceFirmwareUpdate({
      backgroundApi: {} as IBackgroundApi,
    });
    service.detectMap.detectMapCache.DEVICE_USB = {
      detectResultResolved: true,
      updateInfo: {
        firmware: {
          connectId: 'DEVICE_USB',
          hasUpgrade: true,
          hasUpgradeForce: false,
          fromVersion: '4.21.0',
          toVersion: '4.22.0',
          firmwareType: 'firmware',
        } as IFirmwareUpdateInfo,
      },
    };

    await service.detectMap.updateDetectStatusAtom({
      connectId: 'DEVICE_USB',
    });

    const updater = jest.mocked(firmwareUpdatesDetectStatusPersistAtom.set).mock
      .calls[0][0] as (value: unknown) => Record<string, unknown>;
    const updatedValue = updater({
      DEVICE_USB: { connectId: 'DEVICE_USB', hasUpgrade: false },
      OTHER_DEVICE: { connectId: 'OTHER_DEVICE', hasUpgrade: true },
    });

    expect(updatedValue).toMatchObject({
      DEVICE_USB: {
        connectId: 'DEVICE_USB',
        hasUpgrade: true,
        toVersion: '4.22.0',
      },
      OTHER_DEVICE: { connectId: 'OTHER_DEVICE', hasUpgrade: true },
    });
  });

  it('removes a stale persisted update when firmware and BLE are current', async () => {
    const service = new ServiceFirmwareUpdate({
      backgroundApi: {} as IBackgroundApi,
    });

    await service.detectMap.resolveUpdateInfo({
      connectId: 'DEVICE_USB',
      firmware: {
        hasUpgrade: false,
      } as IFirmwareUpdateInfo,
      ble: {
        hasUpgrade: false,
      } as IBleFirmwareUpdateInfo,
    });

    expect(
      service.detectMap.getDetectStatus({
        connectId: 'DEVICE_USB',
      }),
    ).toEqual({
      requestedConnectId: 'DEVICE_USB',
      resolved: true,
      status: undefined,
    });
    const updater = jest.mocked(firmwareUpdatesDetectStatusPersistAtom.set).mock
      .calls[0][0] as (value: unknown) => unknown;
    expect(
      updater({
        DEVICE_USB: { connectId: 'DEVICE_USB', hasUpgrade: true },
      }),
    ).toBeUndefined();
  });

  it('keeps a Protocol V2 target-only update', async () => {
    const service = new ServiceFirmwareUpdate({
      backgroundApi: {} as IBackgroundApi,
    });

    await service.detectMap.resolveUpdateInfo({
      connectId: 'PRO2_USB',
      firmware: { hasUpgrade: false } as IFirmwareUpdateInfo,
      ble: { hasUpgrade: false } as IBleFirmwareUpdateInfo,
      targetsToUpdate: ['resource'],
    });

    expect(
      service.detectMap.getDetectStatus({ connectId: 'PRO2_USB' }),
    ).toEqual({
      requestedConnectId: 'PRO2_USB',
      resolved: true,
      status: {
        connectId: 'PRO2_USB',
        hasUpgrade: true,
        toVersion: undefined,
        toFirmwareType: undefined,
        toVersionBle: undefined,
      },
    });
  });

  it('keeps firmware and BLE component results for the same connectId', async () => {
    const service = new ServiceFirmwareUpdate({
      backgroundApi: {
        serviceDevSetting: {
          getFirmwareUpdateDevSettings: jest.fn().mockResolvedValue(false),
        },
      } as unknown as IBackgroundApi,
    });
    const firmware = {
      connectId: 'DEVICE_USB',
      hasUpgrade: true,
      hasUpgradeForce: false,
      fromVersion: '4.21.0',
      toVersion: '4.23.0',
      firmwareType: 'firmware',
    } as IFirmwareUpdateInfo;
    const ble = {
      connectId: 'DEVICE_USB',
      hasUpgrade: true,
      hasUpgradeForce: false,
      fromVersion: '2.3.7',
      toVersion: '2.4.0',
      firmwareType: 'ble',
    } as IBleFirmwareUpdateInfo;

    await service.detectMap.updateFirmwareUpdateInfo({
      connectId: 'DEVICE_USB',
      updateInfo: firmware,
    });
    await service.detectMap.updateBleFirmwareUpdateInfo({
      connectId: 'DEVICE_USB',
      updateInfo: ble,
    });

    expect(service.detectMap.detectMapCache.DEVICE_USB?.updateInfo).toEqual({
      firmware,
      ble,
    });
    expect(
      service.detectMap.getDetectStatus({
        connectId: 'DEVICE_USB',
      }).status,
    ).toMatchObject({
      hasUpgrade: true,
      toVersion: '4.23.0',
      toVersionBle: '2.4.0',
    });
  });

  it('preserves persisted status while a detect result is unresolved', async () => {
    const service = new ServiceFirmwareUpdate({
      backgroundApi: {} as IBackgroundApi,
    });
    service.detectMap.detectMapCache.DEVICE_USB = {
      lastDetectAt: Date.now(),
    };

    await service.detectMap.updateDetectStatusAtom({
      connectId: 'DEVICE_USB',
    });

    expect(firmwareUpdatesDetectStatusPersistAtom.set).not.toHaveBeenCalled();
  });

  it('returns snapshots for a batch of connectIds', async () => {
    const service = new ServiceFirmwareUpdate({
      backgroundApi: {} as IBackgroundApi,
    });
    service.detectMap.detectMapCache.DEVICE_USB = {
      detectResultResolved: true,
      updateInfo: undefined,
    };

    await expect(
      service.getFirmwareUpdateDetectStatuses({
        connectIds: ['DEVICE_USB', 'UNKNOWN_DEVICE'],
      }),
    ).resolves.toEqual({
      DEVICE_USB: {
        requestedConnectId: 'DEVICE_USB',
        resolved: true,
        status: undefined,
      },
      UNKNOWN_DEVICE: {
        requestedConnectId: 'UNKNOWN_DEVICE',
        resolved: false,
        status: undefined,
      },
    });
    expect(mockedLocalDb.getAllDevices.mock.calls).toHaveLength(0);
    expect(mockedLocalDb.getDeviceByQuery.mock.calls).toHaveLength(2);
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

describe('buildProtocolV2PlanForceTargets', () => {
  it('does not synthesize a resource update when no developer target is selected', () => {
    expect(buildProtocolV2PlanForceTargets({})).toEqual([]);
  });

  it('merges developer targets without forcing a full resource reinstall', () => {
    expect(
      buildProtocolV2PlanForceTargets({
        forceTargets: ['app_v1', 'resource'],
        forceOnceTargets: ['coprocessor'],
      }),
    ).toEqual(['app_v1', 'resource', 'coprocessor']);
  });
});

describe('shouldForceProtocolV2ResourceUpdate', () => {
  it('does not force an automatically selected resource', () => {
    expect(
      shouldForceProtocolV2ResourceUpdate({
        targetsToUpdate: ['resource'],
      }),
    ).toBe(false);
  });

  it.each([
    { forceTargets: ['resource'] as const },
    { forceOnceTargets: ['resource'] as const },
    { legacyForceResource: true },
  ])('forces resource reinstall for $#. configured override', (overrides) => {
    expect(
      shouldForceProtocolV2ResourceUpdate({
        targetsToUpdate: ['resource'],
        ...overrides,
      }),
    ).toBe(true);
  });

  it('does not force a skipped resource even when an override remains set', () => {
    expect(
      shouldForceProtocolV2ResourceUpdate({
        targetsToUpdate: ['app_v1'],
        forceTargets: ['resource'],
      }),
    ).toBe(false);
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

  it.each(['se01', 'se02', 'se03', 'se04'] as const)(
    'does not report an %s-only update as a SafeOS transition',
    (target) => {
      expect(
        buildProtocolV2FirmwareVersionInfo({
          releaseInfo,
          targetsToUpdate: [target],
        }),
      ).toMatchObject({
        safeOS: {
          currentVersion: '1.0.0',
          targetVersion: null,
        },
      });
    },
  );
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

  it('does not pass Protocol V2 resource binaries outside PreparedPlan', async () => {
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

    await service.updatingFirmwareV4({
      connectId: 'PRO2_CONNECT_ID',
      bleVersion: undefined,
      firmwareVersion: undefined,
      bootloaderVersion: undefined,
      firmwareType: undefined,
      isPro2Device: true,
      pro2TargetsToUpdate: ['resource'],
      requirePreparedArtifacts: false,
      targetsToUpdate: ['resource'],
    });

    expect(firmwareUpdateV4).toHaveBeenCalledTimes(1);
    expect(firmwareUpdateV4.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        forcedUpdateRes: false,
        targetsToUpdate: ['resource'],
      }),
    );
    expect(firmwareUpdateStepInfoAtom.set).toHaveBeenCalledWith({
      step: 'installing',
      payload: { installingTarget: {} },
    });
  });

  it.each([
    {
      target: 'app_v1' as const,
      expectedVersions: {
        firmwareVersion: '3.0.0',
        bootloaderVersion: undefined,
        bleVersion: undefined,
      },
      actualVersions: {
        firmwareVersion: '2.0.0',
        bootloaderVersion: '1.0.0',
        bleVersion: '1.0.0',
      },
    },
    {
      target: 'boot' as const,
      expectedVersions: {
        firmwareVersion: undefined,
        bootloaderVersion: '3.0.0',
        bleVersion: undefined,
      },
      actualVersions: {
        firmwareVersion: '1.0.0',
        bootloaderVersion: '2.0.0',
        bleVersion: '1.0.0',
      },
    },
    {
      target: 'coprocessor' as const,
      expectedVersions: {
        firmwareVersion: undefined,
        bootloaderVersion: undefined,
        bleVersion: '3.0.0',
      },
      actualVersions: {
        firmwareVersion: '1.0.0',
        bootloaderVersion: '1.0.0',
        bleVersion: '2.0.0',
      },
    },
  ])(
    'rejects a Protocol V2 $target final version mismatch',
    async ({ target, expectedVersions, actualVersions }) => {
      const firmwareUpdateV4 = jest.fn().mockResolvedValue({
        success: true,
        payload: actualVersions,
      });
      const service = new ServiceFirmwareUpdate({
        backgroundApi: {
          serviceHardware: {
            getSDKInstance: jest.fn().mockResolvedValue({
              firmwareUpdateV4,
              on: jest.fn(),
              off: jest.fn(),
            }),
          },
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

      await expect(
        service.updatingFirmwareV4({
          connectId: 'PRO2_CONNECT_ID',
          ...expectedVersions,
          firmwareType: undefined,
          isPro2Device: true,
          pro2TargetsToUpdate: [target],
          requirePreparedArtifacts: false,
          targetsToUpdate: [target],
        }),
      ).rejects.toMatchObject({
        code: HardwareErrorCode.FirmwareVerificationFailed,
        message: 'FirmwareUpdateVersionMismatch',
      });
    },
  );

  it('accepts matching Protocol V2 final versions', async () => {
    const firmwareUpdateV4 = jest.fn().mockResolvedValue({
      success: true,
      payload: {
        firmwareVersion: '3.0.0',
        bootloaderVersion: '2.0.0',
        bleVersion: '1.0.0',
      },
    });
    const service = new ServiceFirmwareUpdate({
      backgroundApi: {
        serviceHardware: {
          getSDKInstance: jest.fn().mockResolvedValue({
            firmwareUpdateV4,
            on: jest.fn(),
            off: jest.fn(),
          }),
        },
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

    await expect(
      service.updatingFirmwareV4({
        connectId: 'PRO2_CONNECT_ID',
        firmwareVersion: '3.0.0',
        bootloaderVersion: '2.0.0',
        bleVersion: '1.0.0',
        firmwareType: undefined,
        isPro2Device: true,
        pro2TargetsToUpdate: ['app_v1', 'boot', 'coprocessor'],
        requirePreparedArtifacts: false,
        targetsToUpdate: ['app_v1', 'boot', 'coprocessor'],
      }),
    ).resolves.toMatchObject({
      message: 'success',
      firmwareVersion: '3.0.0',
      bootloaderVersion: '2.0.0',
      bleVersion: '1.0.0',
    });
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
          deviceStageBurst: { silenceForFirmwareWorkflow: jest.fn() },
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

    expect(hardwareUiStateCompletedAtom.set).toHaveBeenCalledWith(undefined);
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
          deviceStageBurst: { silenceForFirmwareWorkflow: jest.fn() },
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

  it('updates persisted version info after the device restarts', async () => {
    jest.clearAllMocks();
    mockedLocalDb.getDeviceByQuery.mockResolvedValue(undefined);
    jest.mocked(firmwareUpdateWorkflowRunningAtom.get).mockResolvedValue(true);
    const updateDeviceVersionAfterFirmwareUpdate = jest
      .fn()
      .mockResolvedValue(undefined);
    const waitDeviceRestart = jest.fn().mockResolvedValue(undefined);
    const withWorkflowArtifacts = jest.fn(
      async (
        _releaseResult: ICheckAllFirmwareReleaseResult,
        execute: (artifacts: undefined) => Promise<void>,
      ) => execute(undefined),
    );
    const service = new ServiceFirmwareUpdate({
      backgroundApi: {
        serviceHardwareUI: {
          deviceStageBurst: { silenceForFirmwareWorkflow: jest.fn() },
          withHardwareProcessing: jest.fn(
            async (callback: () => Promise<void>) => callback(),
          ),
        },
        serviceHardware: {
          getCurrentTransportType: jest
            .fn()
            .mockResolvedValue(EHardwareTransportType.WEBUSB),
          setForceTransportType: jest.fn().mockResolvedValue(undefined),
          clearForceTransportType: jest.fn().mockResolvedValue(undefined),
          updateDeviceVersionAfterFirmwareUpdate,
        },
      } as unknown as IBackgroundApi,
    });

    jest.spyOn(timerUtils, 'wait').mockResolvedValue(undefined);
    jest
      .spyOn(
        service as unknown as {
          getFirmwareUpdateRuntimeHost: () => Promise<unknown>;
        },
        'getFirmwareUpdateRuntimeHost',
      )
      .mockResolvedValue({ artifacts: { withWorkflowArtifacts } });
    jest
      .spyOn(service, 'validateMnemonicBackuped')
      .mockResolvedValue(undefined);
    jest.spyOn(service, 'validateUSBConnection').mockResolvedValue(undefined);
    jest
      .spyOn(service, 'validateShouldUpdateFullResource')
      .mockResolvedValue(undefined);
    jest
      .spyOn(service, 'validateMinVersionAllowed')
      .mockResolvedValue(undefined);
    jest.spyOn(service, 'validateDeviceBattery').mockResolvedValue(undefined);
    jest
      .spyOn(service, 'validateShouldUpdateBridge')
      .mockResolvedValue(undefined);
    jest.spyOn(service, 'updateTasksClear').mockResolvedValue(undefined);
    jest
      .spyOn(service, 'waitDeviceRestart')
      .mockImplementation(waitDeviceRestart);
    jest
      .spyOn(
        service as unknown as {
          deleteFirmwareUpdateDetectInfo: (connectId: string) => Promise<void>;
        },
        'deleteFirmwareUpdateDetectInfo',
      )
      .mockResolvedValue(undefined);
    jest
      .spyOn(service, 'clearOnceUpdateDevSettings')
      .mockResolvedValue(undefined);

    await service.startUpdateWorkflow({
      backuped: true,
      usbConnected: true,
      releaseResult: {
        deviceType: EDeviceType.Classic,
        originalConnectId: 'CLASSIC_USB',
        updateInfos: {},
      },
    } as never);

    expect(waitDeviceRestart.mock.invocationCallOrder[0]).toBeLessThan(
      updateDeviceVersionAfterFirmwareUpdate.mock.invocationCallOrder[0],
    );
  });
});

describe('ServiceFirmwareUpdate Protocol V2 desktop transport', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('resolves Desktop BLE to USB before locking the firmware transport', async () => {
    const startedSpy = jest
      .spyOn(defaultLogger.update.firmware, 'firmwareUpdateStarted')
      .mockImplementation((params) => params);
    const setForceTransportType = jest.fn().mockResolvedValue(undefined);
    const clearForceTransportType = jest.fn().mockResolvedValue(undefined);
    const resolveHardwareTransport = jest.fn().mockResolvedValue({
      connectId: 'PRO2_USB_ID',
      transportType: EHardwareTransportType.WEBUSB,
    });
    const service = new ServiceFirmwareUpdate({
      backgroundApi: {
        serviceHardwareUI: {
          deviceStageBurst: { silenceForFirmwareWorkflow: jest.fn() },
          withHardwareProcessing: jest.fn(
            async (callback: () => Promise<void>) => callback(),
          ),
        },
        serviceHardware: {
          getCurrentTransportType: jest
            .fn()
            .mockResolvedValue(EHardwareTransportType.DesktopWebBle),
          resolveHardwareTransport,
          setForceTransportType,
          clearForceTransportType,
        },
      } as unknown as IBackgroundApi,
    });
    jest.spyOn(timerUtils, 'wait').mockResolvedValue(undefined);
    jest
      .spyOn(service, 'validateMnemonicBackuped')
      .mockRejectedValue(new Error('stop after transport lock'));
    const releaseResult = {
      originalConnectId: 'PRO2_BLE_ID',
      updatingConnectId: 'PRO2_BLE_ID',
      updateInfos: {},
    } as ICheckAllFirmwareReleaseResult;
    const workflowId = service.resetUpdateWorkflowTracking({
      updateFlow: 'v2',
      releaseResult,
    });

    await expect(
      service.runUpdateWorkflowV2(
        {
          backuped: true,
          usbConnected: true,
          releaseResult,
        },
        workflowId,
      ),
    ).rejects.toThrow('stop after transport lock');

    expect(resolveHardwareTransport).toHaveBeenCalledWith({
      connectId: 'PRO2_BLE_ID',
      hardwareCallContext: EHardwareCallContext.UPDATE_FIRMWARE,
    });
    expect(setForceTransportType).toHaveBeenCalledWith({
      forceTransportType: EHardwareTransportType.WEBUSB,
    });
    expect(releaseResult.updatingConnectId).toBeUndefined();
    expect(startedSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        transportType: EHardwareTransportType.WEBUSB,
        updateFlow: 'v2',
      }),
    );
    expect(service.updateWorkflowTracking?.transportType).toBe(
      EHardwareTransportType.WEBUSB,
    );
    expect(clearForceTransportType).toHaveBeenCalledTimes(1);
  });
});

describe('ServiceFirmwareUpdate workflow tracking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('clears stale transfer samples before starting a V2 workflow', async () => {
    const service = new ServiceFirmwareUpdate({
      backgroundApi: {
        serviceHardwareUI: {
          deviceStageBurst: { silenceForFirmwareWorkflow: jest.fn() },
        },
      } as unknown as IBackgroundApi,
    });
    jest
      .spyOn(service, 'runUpdateWorkflowV2')
      .mockReturnValue(new Promise(() => undefined));

    await service.startUpdateWorkflowV2({
      backuped: true,
      usbConnected: true,
      releaseResult: {
        updateInfos: {},
      } as ICheckAllFirmwareReleaseResult,
    });

    expect(hardwareUiStateCompletedAtom.set).toHaveBeenCalledWith(undefined);
  });

  it('does not report a workflow that only ends in cancellation', async () => {
    const resultSpy = jest
      .spyOn(defaultLogger.update.firmware, 'firmwareUpdateResult')
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
    const releaseResult = {
      updateInfos: {},
    } as ICheckAllFirmwareReleaseResult;
    const workflowId = service.resetUpdateWorkflowTracking({
      updateFlow: 'v2',
      releaseResult,
    });
    service.recordUpdateWorkflowTransportType(
      workflowId,
      EHardwareTransportType.WEBUSB,
    );

    await service.failUpdateWorkflow({
      params: {
        backuped: true,
        usbConnected: false,
        releaseResult,
      },
      error: new Error('ARTIFACT_CANCELLED'),
    });

    expect(resultSpy).not.toHaveBeenCalled();
  });

  it('reports the last real failure when the user exits from retry', async () => {
    const resultSpy = jest
      .spyOn(defaultLogger.update.firmware, 'firmwareUpdateResult')
      .mockImplementation((params) => params);
    const service = new ServiceFirmwareUpdate({
      backgroundApi: {
        serviceSetting: {
          getHardwareTransportType: jest
            .fn()
            .mockResolvedValue(EHardwareTransportType.WEBUSB),
        },
      } as unknown as IBackgroundApi,
    });
    const releaseResult = {
      updateInfos: {},
    } as ICheckAllFirmwareReleaseResult;
    const workflowId = service.resetUpdateWorkflowTracking({
      updateFlow: 'v2',
      releaseResult,
    });
    service.recordUpdateWorkflowFailure(
      workflowId,
      Object.assign(new Error('transfer failed'), {
        code: HardwareErrorCode.EmmcFileWriteFirmwareError,
      }),
    );

    await service.failUpdateWorkflow({
      params: {
        backuped: true,
        usbConnected: false,
        releaseResult,
      },
      error: new Error('ARTIFACT_CANCELLED'),
    });

    expect(resultSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        failureType: 'transfer',
        errorCode: String(HardwareErrorCode.EmmcFileWriteFirmwareError),
      }),
    );
  });

  it('reports distinct transfer and total workflow durations', async () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1000);
    jest.mocked(hardwareUiStateAtom.get).mockResolvedValue({
      payload: {
        firmwareTransferMetrics: {
          transferredBytes: 2_440_562,
          totalBytes: 2_440_562,
          rateBytesPerSecond: 16_760,
          elapsedMs: 145_620,
        },
      },
    } as never);
    jest.mocked(hardwareUiStateCompletedAtom.get).mockResolvedValue(undefined);
    const service = new ServiceFirmwareUpdate({
      backgroundApi: {} as IBackgroundApi,
    });

    service.resetUpdateWorkflowTracking({
      updateFlow: 'v2',
      releaseResult: {} as ICheckAllFirmwareReleaseResult,
    });
    nowSpy.mockReturnValue(212_960);

    expect(await service.getUpdateWorkflowTrackingInfo()).toEqual({
      retryCount: 0,
      totalDurationMs: 211_960,
      transferredBytes: 2_440_562,
      totalBytes: 2_440_562,
      averageTransferRateBytesPerSecond: 16_760,
      transferDurationMs: 145_620,
      lastFailureType: undefined,
      lastErrorCode: undefined,
    });
  });

  it('ignores a late task failure after a new workflow starts', async () => {
    jest.mocked(firmwareUpdateWorkflowRunningAtom.get).mockResolvedValue(true);
    jest.mocked(firmwareUpdateRetryAtom.get).mockResolvedValue(undefined);
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

    expect(firmwareUpdateRetryAtom.set).toHaveBeenCalledTimes(1);
    expect(await service.getUpdateWorkflowTrackingInfo()).toEqual(
      expect.objectContaining({
        retryCount: 0,
        lastFailureType: undefined,
      }),
    );
  });

  it('ignores task results after the user exits the workflow', async () => {
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
    expect(
      service.recordUpdateWorkflowFailure(
        workflowId,
        new Error('late hardware cancellation'),
      ),
    ).toBe(false);

    expect(await service.getUpdateWorkflowTrackingInfo()).toEqual(
      expect.objectContaining({
        retryCount: 0,
        lastFailureType: undefined,
      }),
    );
  });

  it('increments retryCount only when retryUpdateTask starts', async () => {
    const service = new ServiceFirmwareUpdate({
      backgroundApi: {
        serviceHardwareUI: {
          deviceStageBurst: { silenceForFirmwareWorkflow: jest.fn() },
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

  it('records a task failure before exposing retry state', async () => {
    jest.mocked(firmwareUpdateWorkflowRunningAtom.get).mockResolvedValue(true);
    jest.mocked(firmwareUpdateRetryAtom.get).mockResolvedValue(undefined);
    const service = new ServiceFirmwareUpdate({
      backgroundApi: {
        serviceHardwareUI: {
          deviceStageBurst: { silenceForFirmwareWorkflow: jest.fn() },
          closeHardwareUiStateDialog: jest.fn(),
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

    expect(firmwareUpdateStepInfoAtom.set).toHaveBeenCalledWith({
      step: 'installing',
      payload: {},
    });
    expect(firmwareUpdateRetryAtom.set).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1 }),
    );
    expect(await service.getUpdateWorkflowTrackingInfo()).toEqual(
      expect.objectContaining({ lastFailureType: 'unknown' }),
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

  test('rejects a resource-only Protocol V2 update without PreparedPlan', async () => {
    const service = createService();
    const updatingFirmwareV4 = jest.spyOn(service, 'updatingFirmwareV4');

    await expect(
      service.startUpdateFirmwareTaskForNewBootVersion({
        backuped: true,
        usbConnected: true,
        releaseResult: {
          deviceType: EDeviceType.Pro2,
          pro2TargetsToUpdate: ['resource'],
          updateInfos: {},
        } as ICheckAllFirmwareReleaseResult,
      }),
    ).rejects.toThrow(
      'Firmware update plan is required for Protocol V2 updates',
    );
    expect(updatingFirmwareV4).not.toHaveBeenCalled();
  });

  test('rejects Protocol V2 component targets when no prepared Plan exists', async () => {
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
          pro2TargetsToUpdate: ['boot', 'app_v1', 'resource'],
          updateInfos: {},
        } as ICheckAllFirmwareReleaseResult,
      }),
    ).rejects.toThrow(
      'Firmware update plan is required for Protocol V2 updates',
    );

    expect(createRunTaskWithRetry).not.toHaveBeenCalled();
    expect(updatingFirmwareV4).not.toHaveBeenCalled();
  });

  test('fails closed before inspecting Protocol V2 targets when no Plan exists', async () => {
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
      'Firmware update plan is required for Protocol V2 updates',
    );

    expect(createRunTaskWithRetry).not.toHaveBeenCalled();
    expect(updatingFirmwareV4).not.toHaveBeenCalled();
  });

  test('requires App-prepared artifacts whenever the Pro2 Plan is present', async () => {
    const service = createService();
    const plan = {
      executor: 'v4',
      targetsToUpdate: ['boot', 'app_v1', 'resource'],
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
        pro2TargetsToUpdate: ['boot', 'app_v1', 'resource'],
        updateInfos: {},
      } as ICheckAllFirmwareReleaseResult,
    });

    expect(updatingFirmwareV4).toHaveBeenCalledWith(
      expect.objectContaining({
        requirePreparedArtifacts: true,
        targetsToUpdate: ['boot', 'app_v1', 'resource'],
      }),
      undefined,
    );
  });

  test('lets Extension execute a Protocol V2 Plan through SDK-managed V4', async () => {
    const previousPlatform = {
      isDesktop: platformEnv.isDesktop,
      isNative: platformEnv.isNative,
      symbol: platformEnv.symbol,
    };
    Object.assign(platformEnv, {
      isDesktop: false,
      isNative: false,
      symbol: 'ext',
    });
    try {
      const service = createService();
      const plan = {
        executor: 'v4',
        targetsToUpdate: ['app_v1'],
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
          firmwareUpdatePlanDigest: 'd'.repeat(64),
          pro2TargetsToUpdate: ['app_v1'],
          updateInfos: {},
        } as ICheckAllFirmwareReleaseResult,
      });

      expect(updatingFirmwareV4).toHaveBeenCalledWith(
        expect.objectContaining({
          requirePreparedArtifacts: false,
          targetsToUpdate: ['app_v1'],
        }),
        undefined,
      );
    } finally {
      Object.assign(platformEnv, previousPlatform);
    }
  });
});
