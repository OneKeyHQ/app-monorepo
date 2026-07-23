import { BigNumber } from 'bignumber.js';

import { resolveTpSlTriggerPx } from './resolveTpSlTriggerPx';
import { buildDefaultTpSlPercent, shouldSeedPositionTpSlLeg } from './tpslSeed';

describe('TP/SL default seeds', () => {
  it('fills empty legs with ten-percent ROE and preserves existing values', () => {
    expect(buildDefaultTpSlPercent()).toEqual({
      tpType: 'percentage',
      tpValue: '10',
      slType: 'percentage',
      slValue: '10',
    });
    expect(
      buildDefaultTpSlPercent({
        tpType: 'price',
        tpValue: '120',
        slType: 'percentage',
        slValue: '',
      }),
    ).toEqual({
      tpType: 'price',
      tpValue: '120',
      slType: 'percentage',
      slValue: '10',
    });
  });

  it.each([
    ['long', 1, '110', '90'],
    ['long', 5, '102', '98'],
    ['long', 20, '100.5', '99.5'],
    ['short', 1, '90', '110'],
    ['short', 5, '98', '102'],
    ['short', 20, '99.5', '100.5'],
  ] as const)(
    'resolves %s leverage %s from entry rather than the current mark',
    (side, leverage, tpTriggerPx, slTriggerPx) => {
      expect(
        resolveTpSlTriggerPx({
          hasTpsl: true,
          ...buildDefaultTpSlPercent(),
          referencePrice: new BigNumber(100),
          side,
          leverage,
        }),
      ).toEqual({ tpTriggerPx, slTriggerPx });
    },
  );

  it('seeds each position leg only before an existing value or user action', () => {
    const base = {
      hasExistingOrder: false,
      hasPreset: false,
      currentValue: '',
      userEdited: false,
      seeded: false,
    };
    expect(shouldSeedPositionTpSlLeg(base)).toBe(true);
    expect(shouldSeedPositionTpSlLeg({ ...base, hasExistingOrder: true })).toBe(
      false,
    );
    expect(shouldSeedPositionTpSlLeg({ ...base, hasPreset: true })).toBe(false);
    expect(shouldSeedPositionTpSlLeg({ ...base, currentValue: '101' })).toBe(
      false,
    );
    expect(shouldSeedPositionTpSlLeg({ ...base, userEdited: true })).toBe(
      false,
    );
    expect(shouldSeedPositionTpSlLeg({ ...base, seeded: true })).toBe(false);
  });
});
