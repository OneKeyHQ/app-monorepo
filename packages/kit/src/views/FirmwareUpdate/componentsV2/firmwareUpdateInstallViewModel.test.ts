import { EFirmwareType } from '@onekeyfe/hd-shared';

import { EFirmwareUpdateTipMessages } from '@onekeyhq/shared/types/device';
import type { ICheckAllFirmwareReleaseResult } from '@onekeyhq/shared/types/device';

import {
  formatFirmwareUpdateVersionRange,
  getFirmwareUpdateItems,
  getFirmwareUpdateStage,
  getPrimaryFirmwareUpdateItem,
  getRemainingTimeBucket,
  sliceOverallProgress,
} from './firmwareUpdateInstallViewModel';

describe('firmwareUpdateInstallViewModel', () => {
  test('maps every tip into one of the install stages', () => {
    expect(getFirmwareUpdateStage({ progressType: undefined })).toBe(
      'preparing',
    );
    expect(getFirmwareUpdateStage({ progressType: 'checking' })).toBe(
      'preparing',
    );
    expect(
      getFirmwareUpdateStage({
        progressType: EFirmwareUpdateTipMessages.DownloadLatestUiResource,
      }),
    ).toBe('downloading');
    expect(
      getFirmwareUpdateStage({
        progressType: EFirmwareUpdateTipMessages.AutoRebootToBootloader,
      }),
    ).toBe('enteringUpdateMode');
    expect(
      getFirmwareUpdateStage({
        progressType: EFirmwareUpdateTipMessages.ConfirmOnDevice,
      }),
    ).toBe('waitingForDevice');
    expect(
      getFirmwareUpdateStage({
        progressType: EFirmwareUpdateTipMessages.StartTransferData,
      }),
    ).toBe('transferring');
    expect(
      getFirmwareUpdateStage({
        progressType: EFirmwareUpdateTipMessages.InstallingFirmware,
      }),
    ).toBe('installing');
    expect(
      getFirmwareUpdateStage({
        progressType: 'installing',
        installPhase: 'verify',
      }),
    ).toBe('verifying');
    expect(
      getFirmwareUpdateStage({
        progressType: EFirmwareUpdateTipMessages.FirmwareUpdateCompleted,
      }),
    ).toBe('verifying');
  });

  test('buckets remaining time into minutes only', () => {
    expect(getRemainingTimeBucket(73_000)).toEqual({ kind: 'oneMinute' });
    expect(getRemainingTimeBucket(29_000)).toEqual({ kind: 'underMinute' });
    expect(getRemainingTimeBucket(90_000)).toEqual({
      kind: 'minutes',
      minutes: 2,
    });
    expect(getRemainingTimeBucket(181_000)).toEqual({
      kind: 'minutes',
      minutes: 4,
    });
  });

  test('slices a multi-part update into one monotonic bar', () => {
    expect(
      sliceOverallProgress({
        phaseIndex: 0,
        totalPhases: 3,
        phaseProgress: 60,
      }),
    ).toBe(20);
    expect(
      sliceOverallProgress({ phaseIndex: 1, totalPhases: 3, phaseProgress: 0 }),
    ).toBeCloseTo(33.33, 1);
    expect(
      sliceOverallProgress({
        phaseIndex: 2,
        totalPhases: 3,
        phaseProgress: 100,
      }),
    ).toBe(100);
    expect(
      sliceOverallProgress({
        phaseIndex: 0,
        totalPhases: 1,
        phaseProgress: 42,
      }),
    ).toBe(42);
  });

  const labels = {
    getProtocolV2Title: (target: string) => target,
    firmwareLabel: 'Firmware',
    bootloaderLabel: 'Bootloader',
    bluetoothLabel: 'Bluetooth',
    getFirmwareTypeLabel: (type: EFirmwareType | undefined) =>
      type === EFirmwareType.BitcoinOnly ? 'Bitcoin-only' : 'Universal',
  };

  test('lists legacy parts in install order and labels a type switch', () => {
    const result = {
      updateInfos: {
        bootloader: {
          hasUpgrade: true,
          fromVersion: '2.8.3',
          toVersion: '2.8.4',
        },
        firmware: {
          hasUpgrade: true,
          fromVersion: '4.21.0',
          toVersion: '4.21.0',
          fromFirmwareType: EFirmwareType.Universal,
          toFirmwareType: EFirmwareType.BitcoinOnly,
        },
        ble: { hasUpgrade: false },
      },
    } as unknown as ICheckAllFirmwareReleaseResult;
    const items = getFirmwareUpdateItems({
      result,
      protocolV2Items: [],
      ...labels,
    });
    expect(items.map((item) => item.key)).toEqual(['bootloader', 'firmware']);
    const primary = getPrimaryFirmwareUpdateItem(items);
    expect(primary?.key).toBe('firmware');
    expect(
      formatFirmwareUpdateVersionRange({
        item: primary!,
        isVersionValid: () => true,
      }),
    ).toEqual({ from: 'Universal 4.21.0', to: 'Bitcoin-only 4.21.0' });
  });

  test('keeps bare versions when the firmware type does not change', () => {
    const result = {
      updateInfos: {
        firmware: {
          hasUpgrade: true,
          fromVersion: '4.12.0',
          toVersion: '4.13.0',
          fromFirmwareType: EFirmwareType.Universal,
          toFirmwareType: EFirmwareType.Universal,
        },
      },
    } as unknown as ICheckAllFirmwareReleaseResult;
    const [item] = getFirmwareUpdateItems({
      result,
      protocolV2Items: [],
      ...labels,
    });
    expect(
      formatFirmwareUpdateVersionRange({ item, isVersionValid: () => true }),
    ).toEqual({ from: '4.12.0', to: '4.13.0' });
    expect(
      formatFirmwareUpdateVersionRange({
        item: { ...item, fromVersion: '0.0.0' },
        isVersionValid: (v) => v !== '0.0.0',
      }),
    ).toEqual({ from: undefined, to: '4.13.0' });
  });

  test('uses the SafeOS list for Protocol V2 devices', () => {
    const result = {
      updateInfos: { firmware: { hasUpgrade: true } },
    } as unknown as ICheckAllFirmwareReleaseResult;
    const items = getFirmwareUpdateItems({
      result,
      protocolV2Items: [
        { target: 'safeos', currentVersion: '1.0.0', targetVersion: '1.0.1' },
      ],
      ...labels,
    });
    expect(items).toEqual([
      {
        key: 'safeos',
        name: 'safeos',
        fromVersion: '1.0.0',
        toVersion: '1.0.1',
        noVersion: undefined,
      },
    ]);
  });
});
