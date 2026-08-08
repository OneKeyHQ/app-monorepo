import { EDeviceType } from '@onekeyfe/hd-shared';

import { NEO_DEVICE_TYPE } from '@onekeyhq/shared/src/utils/hardwareDeviceTypes';
import type { ICheckAllFirmwareReleaseResult } from '@onekeyhq/shared/types/device';

import {
  getFirmwareUpdateDeviceTitle,
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
  it.each([
    [EDeviceType.Pro2, 'OneKey Pro 2'],
    [NEO_DEVICE_TYPE, 'OneKey Neo'],
  ])('协议 V2 设备 %s 使用稳定型号作为标题', (deviceType, expected) => {
    expect(
      getFirmwareUpdateDeviceTitle({
        deviceType,
        deviceName: '用户自定义名称',
      } as ICheckAllFirmwareReleaseResult),
    ).toBe(expected);
  });

  it('旧设备继续沿用原有设备名称', () => {
    expect(
      getFirmwareUpdateDeviceTitle({
        deviceType: EDeviceType.Touch,
        deviceName: '用户自定义名称',
      } as ICheckAllFirmwareReleaseResult),
    ).toBe('用户自定义名称');
  });
});
