import { EDeviceType } from '@onekeyfe/hd-shared';

import type { ICheckAllFirmwareReleaseResult } from '@onekeyhq/shared/types/device';

import { isPro2SafeOSFirmwareUpdate } from './utils';

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
