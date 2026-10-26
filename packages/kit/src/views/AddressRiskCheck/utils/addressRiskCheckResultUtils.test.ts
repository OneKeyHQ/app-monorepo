import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EKytRiskLevel } from '@onekeyhq/shared/types/kyt';
import type { IKytRiskFactor } from '@onekeyhq/shared/types/kyt';

import {
  formatRiskPercent,
  getAddressRiskCheckPendingMessageIds,
  getAddressRiskSummaryVariant,
  getRiskExposureStats,
  getRiskFactorDisplay,
  getRiskScoreMeterPosition,
  isLowShareRiskFactor,
  isRiskTaggedAddress,
} from './addressRiskCheckResultUtils';

describe('getAddressRiskCheckPendingMessageIds', () => {
  it.each([
    [
      'checking',
      { isFailed: false, isInternetReachable: false },
      {
        title: ETranslations.address_risk_check_level_checking__title,
        description: ETranslations.address_risk_check_loading__desc,
      },
    ],
    [
      'offline failure',
      { isFailed: true, isInternetReachable: false },
      {
        title: ETranslations.tray_offline_title,
        description: ETranslations.feedback_you_are_offline,
      },
    ],
    [
      'online failure',
      { isFailed: true, isInternetReachable: true },
      {
        title: ETranslations.address_risk_check_level_failed__title,
        description: ETranslations.address_risk_check_level_failed__desc,
      },
    ],
    [
      'unknown connectivity failure',
      { isFailed: true, isInternetReachable: null },
      {
        title: ETranslations.address_risk_check_level_failed__title,
        description: ETranslations.address_risk_check_level_failed__desc,
      },
    ],
  ] as const)('%s', (_name, input, expected) => {
    expect(getAddressRiskCheckPendingMessageIds(input)).toEqual(expected);
  });
});

describe('getAddressRiskSummaryVariant', () => {
  it.each([
    [EKytRiskLevel.None, 0, 'clean'],
    [EKytRiskLevel.Low, 0, 'clean'],
    [EKytRiskLevel.Low, 4, 'low'],
    [EKytRiskLevel.Moderate, 0, 'moderate'],
    [EKytRiskLevel.High, 2, 'high'],
    [EKytRiskLevel.Severe, 1, 'severe'],
    [EKytRiskLevel.Failed, 0, 'unknown'],
  ] as const)('%s with %d factors -> %s', (level, factorCount, expected) => {
    expect(getAddressRiskSummaryVariant({ level, factorCount })).toBe(expected);
  });
});

const factor = (overrides: Partial<IKytRiskFactor>): IKytRiskFactor => ({
  category: 'illicit_activity',
  ...overrides,
});

describe('getRiskFactorDisplay', () => {
  it('sorts by share and folds minor exposures beyond the minimum', () => {
    const factors = [
      factor({ entity: 'dust-a', percent: 0 }),
      factor({ entity: 'major', percent: 3.1 }),
      factor({ entity: 'dust-b', percent: 0.05 }),
      factor({ entity: 'mid', percent: 0.4 }),
      factor({ entity: 'dust-c', percent: 0.001 }),
      factor({ entity: 'dust-d', percent: 0.002 }),
    ];
    const display = getRiskFactorDisplay(factors);
    expect(display.sorted.map((item) => item.entity)).toEqual([
      'major',
      'mid',
      'dust-b',
      'dust-d',
      'dust-c',
      'dust-a',
    ]);
    expect(display.visibleCount).toBe(3);
    expect(display.hiddenCount).toBe(3);
    expect(display.hiddenAllMinor).toBe(true);
  });

  it('caps significant exposures and flags non-minor hidden items', () => {
    const factors = Array.from({ length: 7 }, (_, index) =>
      factor({ entity: `e${index}`, percent: 10 - index }),
    );
    const display = getRiskFactorDisplay(factors);
    expect(display.visibleCount).toBe(5);
    expect(display.hiddenCount).toBe(2);
    expect(display.hiddenAllMinor).toBe(false);
  });

  it('shows everything when there are only a few exposures', () => {
    const display = getRiskFactorDisplay([
      factor({ percent: 0.01 }),
      factor({}),
    ]);
    expect(display.visibleCount).toBe(2);
    expect(display.hiddenCount).toBe(0);
    expect(display.hiddenAllMinor).toBe(false);
  });
});

describe('getRiskExposureStats', () => {
  it('counts direct exposures and picks the largest share', () => {
    const top = factor({
      entity: 'Theft',
      exposureType: 'indirect',
      percent: 3.1,
    });
    expect(
      getRiskExposureStats([
        factor({ exposureType: 'direct', percent: 1.97 }),
        top,
        factor({ exposureType: 'indirect' }),
      ]),
    ).toEqual({ total: 3, direct: 1, top });
  });

  it('has no top exposure when the list is empty', () => {
    expect(getRiskExposureStats([]).top).toBeUndefined();
  });
});

describe('formatRiskPercent', () => {
  it.each([
    [undefined, '-'],
    [0, '<0.01%'],
    [0.004, '<0.01%'],
    [0.448, '0.45%'],
    [3.1, '3.10%'],
    [45.652, '45.65%'],
    [99.999, '100.00%'],
    [100, '100%'],
  ] as const)('%s -> %s', (input, expected) => {
    expect(formatRiskPercent(input)).toBe(expected);
  });
});

describe('getRiskScoreMeterPosition', () => {
  it.each([
    [0, 0, 0],
    [3, 0, 2.5],
    [30, 0, 25],
    [36, 1, 28.75],
    [70, 1, 50],
    [85, 2, 68.75],
    [100, 3, 100],
    [120, 3, 100],
    [-5, 0, 0],
  ] as const)('score %d -> band %d at %d%%', (score, bandIndex, position) => {
    const result = getRiskScoreMeterPosition(score);
    expect(result.bandIndex).toBe(bandIndex);
    expect(result.positionPercent).toBeCloseTo(position);
  });
});

describe('isRiskTaggedAddress', () => {
  it('treats direct 100% exposures without volume as an address tag', () => {
    expect(
      isRiskTaggedAddress([
        factor({
          entity: 'Theft',
          exposureType: 'direct',
          hops: 1,
          amountUsd: 0,
          percent: 100,
        }),
      ]),
    ).toBe(true);
  });

  it('rejects mixed, partial or volume-backed exposures', () => {
    expect(isRiskTaggedAddress([])).toBe(false);
    expect(
      isRiskTaggedAddress([
        factor({ exposureType: 'direct', amountUsd: 0, percent: 100 }),
        factor({ exposureType: 'indirect', amountUsd: 12, percent: 3 }),
      ]),
    ).toBe(false);
    expect(
      isRiskTaggedAddress([
        factor({ exposureType: 'direct', amountUsd: 75_130, percent: 100 }),
      ]),
    ).toBe(false);
  });
});

describe('isLowShareRiskFactor', () => {
  it.each([
    [0.44, true],
    [0.999, true],
    [1, false],
    [14.48, false],
    [undefined, false],
  ] as const)('share %s -> %s', (percent, expected) => {
    expect(isLowShareRiskFactor(factor({ percent }))).toBe(expected);
  });
});
