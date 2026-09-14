import { createIntl } from 'react-intl';

import { loadLocaleMessages } from '@onekeyhq/shared/src/locale/localeLoaders';
import { EFirmwareUpdateTipMessages } from '@onekeyhq/shared/types/device';

import {
  calculateProgressInRange,
  getFirmwareTransferDisplayMetrics,
  normalizeFirmwareUpdateProgressType,
  resolveFirmwareInstallProgress,
} from './firmwareUpdateProgressUtils';

describe('firmwareUpdateProgressUtils', () => {
  let intl: ReturnType<typeof createIntl>;
  beforeAll(async () => {
    intl = createIntl({
      locale: 'en-US',
      messages: await loadLocaleMessages('en-US'),
    });
  });
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

  test('uses aggregate install progress across phase transitions', () => {
    expect(
      resolveFirmwareInstallProgress({
        installPhaseProgress: 100,
        firmwareProgress: 42,
      }),
    ).toBe(42);
    expect(
      resolveFirmwareInstallProgress({
        installPhaseProgress: 0,
        firmwareProgress: 45,
      }),
    ).toBe(45);
    expect(
      resolveFirmwareInstallProgress({
        installPhaseProgress: 100,
        firmwareProgress: undefined,
      }),
    ).toBeUndefined();
  });

  test('formats stable transfer speed and ETA after warm-up', () => {
    expect(
      getFirmwareTransferDisplayMetrics(
        {
          transferredBytes: 1_220_281,
          totalBytes: 2_440_562,
          rateBytesPerSecond: 16_760,
          elapsedMs: 72_810,
        },
        intl,
      ),
    ).toEqual({
      transferredText: '1.2 MiB',
      totalText: '2.3 MiB',
      speedText: '16.4 KiB/s',
      elapsedText: '1 minutes 13 seconds',
      estimatedRemainingText: '1 minutes 13 seconds',
    });
  });

  test('hides ETA until enough transfer data has been sampled', () => {
    expect(
      getFirmwareTransferDisplayMetrics(
        {
          transferredBytes: 32 * 1024,
          totalBytes: 2_440_562,
          rateBytesPerSecond: 9380,
          elapsedMs: 1500,
        },
        intl,
      ),
    ).toEqual(
      expect.objectContaining({
        speedText: '9.2 KiB/s',
        estimatedRemainingText: undefined,
      }),
    );
  });

  test('rejects incomplete or zero-rate transfer samples', () => {
    expect(
      getFirmwareTransferDisplayMetrics(
        {
          transferredBytes: 1024,
          totalBytes: 2048,
          rateBytesPerSecond: 0,
          elapsedMs: 1000,
        },
        intl,
      ),
    ).toBeUndefined();
  });

  test.each([
    [13, '13 秒'],
    [60, '1 分钟 0 秒'],
    [73, '1 分钟 13 秒'],
    [1200, '20 分钟 0 秒'],
    [1213, '20 分钟 13 秒'],
  ])(
    'preserves localized duration units for %i seconds on iOS Hermes',
    async (durationSeconds, expectedText) => {
      const chineseIntl = createIntl({
        locale: 'zh-CN',
        messages: await loadLocaleMessages('zh-CN'),
      });
      const formatNumber = chineseIntl.formatNumber.bind(chineseIntl);
      // iOS Hermes converts minutes to seconds when formatting unit numbers.
      jest
        .spyOn(chineseIntl, 'formatNumber')
        .mockImplementation((value, options) =>
          formatNumber(
            options?.unit === 'minute' ? Number(value) * 60 : value,
            { ...options, unit: 'second' },
          ),
        );

      expect(
        getFirmwareTransferDisplayMetrics(
          {
            transferredBytes: 128 * 1024,
            totalBytes: 256 * 1024,
            rateBytesPerSecond: (128 * 1024) / durationSeconds,
            elapsedMs: durationSeconds * 1000,
          },
          chineseIntl,
        ),
      ).toMatchObject({
        elapsedText: expectedText,
        estimatedRemainingText: expectedText,
      });
    },
  );
});
