import { EFirmwareUpdateTipMessages } from '@onekeyhq/shared/types/device';

import {
  PRO2_INSTALL_ESTIMATED_PROGRESS_MAX,
  PRO2_RECONNECT_ESTIMATED_PROGRESS_MAX,
  calculateProgressInRange,
  getNextEstimatedFirmwareProgress,
  normalizeFirmwareUpdateProgressType,
} from './firmwareUpdateProgressUtils';

describe('firmwareUpdateProgressUtils', () => {
  test('将 bootloader 就绪事件归一到重启阶段，避免 UI 直接进入传输阶段', () => {
    expect(
      normalizeFirmwareUpdateProgressType(
        EFirmwareUpdateTipMessages.GoToBootloaderSuccess,
      ),
    ).toBe(EFirmwareUpdateTipMessages.AutoRebootToBootloader);
  });

  test('将 SDK 阶段进度映射到 UI 区间并限制上界', () => {
    expect(
      calculateProgressInRange({
        startAt: 50,
        maxAt: 90,
        currentProgress: undefined,
      }),
    ).toBe(50);
    expect(
      calculateProgressInRange({
        startAt: 50,
        maxAt: 90,
        currentProgress: 50,
      }),
    ).toBe(70);
    expect(
      calculateProgressInRange({
        startAt: 50,
        maxAt: 90,
        currentProgress: 150,
      }),
    ).toBe(90);
  });

  test('Pro2 估算进度渐近阶段上限但不会提前触顶', () => {
    let progress = 50;
    for (let index = 0; index < 240; index += 1) {
      progress = getNextEstimatedFirmwareProgress({
        currentProgress: progress,
        maxProgress: PRO2_INSTALL_ESTIMATED_PROGRESS_MAX,
      });
    }

    expect(progress).toBeGreaterThan(88.9);
    expect(progress).toBeLessThan(PRO2_INSTALL_ESTIMATED_PROGRESS_MAX);
  });

  test('重连估算进度不回退真实进度，也不越过验证阶段', () => {
    expect(
      getNextEstimatedFirmwareProgress({
        currentProgress: 90,
        maxProgress: PRO2_INSTALL_ESTIMATED_PROGRESS_MAX,
      }),
    ).toBe(90);

    const reconnectProgress = getNextEstimatedFirmwareProgress({
      currentProgress: 90,
      maxProgress: PRO2_RECONNECT_ESTIMATED_PROGRESS_MAX,
    });
    expect(reconnectProgress).toBeGreaterThan(90);
    expect(reconnectProgress).toBeLessThan(
      PRO2_RECONNECT_ESTIMATED_PROGRESS_MAX,
    );
  });
});
