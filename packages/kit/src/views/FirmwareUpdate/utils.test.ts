import { EDeviceType } from '@onekeyfe/hd-shared';

import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import { NEO_DEVICE_TYPE } from '@onekeyhq/shared/src/utils/hardwareDeviceTypes';
import type { ICheckAllFirmwareReleaseResult } from '@onekeyhq/shared/types/device';

import {
  getFirmwareUpdateDeviceTitle,
  getFirmwareUpdateUSBPreflightParams,
  getProtocolV2FirmwareVersionDisplayItems,
  getProtocolV2ResourceReleaseId,
  hasProtocolV2FirmwareUpdateTarget,
  isPro2SafeOSFirmwareUpdate,
  selectFirmwareUpdateDetectStatus,
} from './utils';

describe('firmware update detect status reconciliation', () => {
  const staleStatus = {
    DEVICE_USB: {
      connectId: 'DEVICE_USB',
      hasUpgrade: true,
      toVersion: '4.18.0',
      toFirmwareType: undefined,
      toVersionBle: undefined,
    },
  };

  it('uses a resolved background snapshot instead of stale main state', () => {
    expect(
      selectFirmwareUpdateDetectStatus({
        connectId: 'DEVICE_USB',
        persistedStatus: staleStatus,
        snapshot: {
          requestedConnectId: 'DEVICE_USB',
          resolved: true,
          status: undefined,
        },
      }),
    ).toBeUndefined();
  });

  it('keeps persisted state until the background runtime has checked', () => {
    expect(
      selectFirmwareUpdateDetectStatus({
        connectId: 'DEVICE_USB',
        persistedStatus: staleStatus,
        snapshot: {
          requestedConnectId: 'DEVICE_USB',
          resolved: false,
        },
      }),
    ).toEqual(staleStatus.DEVICE_USB);
  });

  it('does not fall back to a different persisted connectId key', () => {
    expect(
      selectFirmwareUpdateDetectStatus({
        connectId: 'device_usb',
        persistedStatus: staleStatus,
        snapshot: undefined,
      }),
    ).toBeUndefined();
  });

  it('ignores a snapshot returned for the previously selected device', () => {
    expect(
      selectFirmwareUpdateDetectStatus({
        connectId: 'DEVICE_USB',
        persistedStatus: staleStatus,
        snapshot: {
          requestedConnectId: 'OTHER_DEVICE',
          resolved: true,
        },
      }),
    ).toEqual(staleStatus.DEVICE_USB);
  });
});

describe('getFirmwareUpdateUSBPreflightParams', () => {
  it('uses the release device identity and Protocol V2 mode', async () => {
    await expect(
      getFirmwareUpdateUSBPreflightParams({
        deviceType: EDeviceType.Pro2,
        updatingConnectId: 'PRO2_USB_ID',
      } as ICheckAllFirmwareReleaseResult),
    ).resolves.toEqual({
      connectId: 'PRO2_USB_ID',
      connectProtocol: 'V2',
    });
  });

  it('prefers the USB serial resolved from release features', async () => {
    const buildDeviceUSBConnectId = jest
      .spyOn(deviceUtils, 'buildDeviceUSBConnectId')
      .mockResolvedValue('PRO2_USB_SERIAL');

    await expect(
      getFirmwareUpdateUSBPreflightParams({
        deviceType: EDeviceType.Pro2,
        features: {} as ICheckAllFirmwareReleaseResult['features'],
        updatingConnectId: 'PRO2_BLE_ID',
      } as ICheckAllFirmwareReleaseResult),
    ).resolves.toEqual({
      connectId: 'PRO2_USB_SERIAL',
      connectProtocol: 'V2',
    });

    buildDeviceUSBConnectId.mockRestore();
  });
});

function buildResult({
  deviceType = EDeviceType.Pro2,
  firmwareHasUpgrade = false,
  targets = [],
}: {
  deviceType?: EDeviceType;
  firmwareHasUpgrade?: boolean;
  targets?: ICheckAllFirmwareReleaseResult['pro2TargetsToUpdate'];
}) {
  return {
    deviceType,
    pro2TargetsToUpdate: targets,
    updateInfos: {
      firmware: {
        hasUpgrade: firmwareHasUpgrade,
      },
    },
  } as ICheckAllFirmwareReleaseResult;
}

describe('isPro2SafeOSFirmwareUpdate', () => {
  it('uses the legacy firmware update flag', () => {
    expect(
      isPro2SafeOSFirmwareUpdate(buildResult({ firmwareHasUpgrade: true })),
    ).toBe(true);
  });

  it.each(['app_v1', 'app_v2'] as const)(
    'treats the Pro2 %s target as a SafeOS update',
    (target) => {
      expect(
        isPro2SafeOSFirmwareUpdate(buildResult({ targets: [target] })),
      ).toBe(true);
    },
  );

  it('does not label a Pro2 resource-only update as SafeOS', () => {
    expect(
      isPro2SafeOSFirmwareUpdate(
        buildResult({ targets: ['resource', 'se01'] }),
      ),
    ).toBe(false);
  });

  it('does not label another device as SafeOS', () => {
    expect(
      isPro2SafeOSFirmwareUpdate(
        buildResult({
          deviceType: EDeviceType.Touch,
          firmwareHasUpgrade: true,
          targets: ['app_v1'],
        }),
      ),
    ).toBe(false);
  });
});

describe('getFirmwareUpdateDeviceTitle', () => {
  it.each([EDeviceType.Pro2, NEO_DEVICE_TYPE, EDeviceType.Touch])(
    '设备 %s 优先使用自定义名称',
    (deviceType) => {
      expect(
        getFirmwareUpdateDeviceTitle({
          deviceType,
          deviceName: '用户自定义名称',
        } as ICheckAllFirmwareReleaseResult),
      ).toBe('用户自定义名称');
    },
  );

  it.each([
    [EDeviceType.Pro2, 'OneKey Pro 2'],
    [NEO_DEVICE_TYPE, 'OneKey Neo'],
  ])('设备 %s 缺少名称时回退到稳定型号', (deviceType, expected) => {
    expect(
      getFirmwareUpdateDeviceTitle({
        deviceType,
        deviceName: undefined,
      } as ICheckAllFirmwareReleaseResult),
    ).toBe(expected);
  });
});

describe('Protocol V2 update target display', () => {
  it('always puts SafeOS first and then shows selected component versions', () => {
    const result = {
      ...buildResult({ targets: ['app_v1', 'coprocessor', 'resource'] }),
      protocolV2FirmwareVersionInfo: {
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
      },
      pro2ResourceArchive: {
        archiveSha256: '1234567890abcdef',
        archiveSize: 1024,
      },
    } as ICheckAllFirmwareReleaseResult;

    expect(
      getProtocolV2FirmwareVersionDisplayItems(result, {
        includeComponents: true,
      }),
    ).toEqual([
      {
        target: 'safeos',
        currentVersion: '1.0.0',
        targetVersion: '1.1.0',
      },
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
      {
        target: 'resource',
        currentVersion: null,
        targetVersion: 'SHA-256 1234567890ab',
        releaseIdentifierOnly: true,
      },
    ]);
  });

  it('keeps SafeOS visible for a resource-only update', () => {
    const result = {
      ...buildResult({ targets: ['resource'] }),
      protocolV2FirmwareVersionInfo: {
        safeOS: {
          currentVersion: '1.0.0',
          targetVersion: null,
        },
        components: [],
      },
    } as ICheckAllFirmwareReleaseResult;

    expect(getProtocolV2FirmwareVersionDisplayItems(result)[0]).toEqual({
      target: 'safeos',
      currentVersion: '1.0.0',
      targetVersion: null,
    });
  });

  it('uses the same SafeOS-first model for Neo', () => {
    const result = {
      ...buildResult({ deviceType: NEO_DEVICE_TYPE, targets: ['app_v2'] }),
      protocolV2FirmwareVersionInfo: {
        safeOS: {
          currentVersion: '1.0.0',
          targetVersion: '1.1.0',
        },
        components: [
          {
            target: 'app_v2',
            currentVersion: '1.0.0',
            targetVersion: '1.1.0',
          },
        ],
      },
    } as ICheckAllFirmwareReleaseResult;

    expect(
      getProtocolV2FirmwareVersionDisplayItems(result, {
        includeComponents: true,
      }).map((item) => item.target),
    ).toEqual(['safeos', 'app_v2']);
  });

  it('hides component versions unless explicitly requested', () => {
    const result = {
      ...buildResult({ targets: ['app_v1', 'coprocessor', 'resource'] }),
      protocolV2FirmwareVersionInfo: {
        safeOS: {
          currentVersion: '1.0.0',
          targetVersion: '1.1.0',
        },
        components: [],
      },
    } as ICheckAllFirmwareReleaseResult;

    expect(
      getProtocolV2FirmwareVersionDisplayItems(result).map(
        (item) => item.target,
      ),
    ).toEqual(['safeos']);
  });

  it('detects an independently selected coprocessor target', () => {
    const result = buildResult({ targets: ['coprocessor'] });

    expect(hasProtocolV2FirmwareUpdateTarget(result, 'coprocessor')).toBe(true);
    expect(hasProtocolV2FirmwareUpdateTarget(result, 'resource')).toBe(false);
  });

  it('uses a stable short archive fingerprint for a resource-only update', () => {
    const result = {
      ...buildResult({ targets: ['resource'] }),
      pro2ResourceArchive: {
        archiveSha256:
          '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        archiveSize: 1024,
      },
    };

    expect(getProtocolV2ResourceReleaseId(result)).toBe('SHA-256 1234567890ab');
  });

  it('does not expose a resource fingerprint for unrelated updates', () => {
    const result = {
      ...buildResult({ targets: ['coprocessor'] }),
      pro2ResourceArchive: {
        archiveSha256: 'a'.repeat(64),
        archiveSize: 1024,
      },
    };

    expect(getProtocolV2ResourceReleaseId(result)).toBeUndefined();
  });
});
