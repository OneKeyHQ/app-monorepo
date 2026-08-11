import { EDeviceType } from '@onekeyfe/hd-shared';

import { NEO_DEVICE_TYPE } from '@onekeyhq/shared/src/utils/hardwareDeviceTypes';
import type { ICheckAllFirmwareReleaseResult } from '@onekeyhq/shared/types/device';

import {
  getFirmwareUpdateDeviceTitle,
  getProtocolV2FirmwareVersionDisplayItems,
  getProtocolV2ResourceReleaseId,
  hasProtocolV2FirmwareUpdateTarget,
  isPro2SafeOSFirmwareUpdate,
} from './utils';

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

    expect(getProtocolV2FirmwareVersionDisplayItems(result)).toEqual([
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
      getProtocolV2FirmwareVersionDisplayItems(result).map(
        (item) => item.target,
      ),
    ).toEqual(['safeos', 'app_v2']);
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
