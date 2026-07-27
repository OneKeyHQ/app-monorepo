import { BigNumber } from 'bignumber.js';

import {
  formatPriceToSignificantDigits,
  getHlPriceTick,
  snapHlPriceToGrid,
} from '@onekeyhq/shared/src/utils/perpsUtils';

import { resolveTpSlTriggerPx } from './resolveTpSlTriggerPx';
import {
  DEFAULT_TPSL_ROE_PERCENT,
  buildDefaultTpSlPercent,
  shouldSeedPositionTpSlLeg,
} from './tpslSeed';

// Mirrors TpslInput.calculatePrice: the seeded-percent display hint only reads
// as "10" when the seeded price matches this manual percent->price conversion.
function manualPercentToPrice({
  percent,
  entry,
  leverage,
  side,
  isTP,
  szDecimals,
}: {
  percent: string;
  entry: string;
  leverage: number;
  side: 'long' | 'short';
  isTP: boolean;
  szDecimals: number;
}): string {
  const referencePrice = new BigNumber(entry);
  const adjustedPercent = new BigNumber(percent).dividedBy(leverage);
  const multiplier =
    (side === 'long') === isTP
      ? new BigNumber(100).plus(adjustedPercent)
      : new BigNumber(100).minus(adjustedPercent);
  const rawPrice = referencePrice.multipliedBy(multiplier).dividedBy(100);
  const snapped =
    snapHlPriceToGrid(rawPrice, 'nearest', szDecimals) ?? rawPrice;
  return formatPriceToSignificantDigits(snapped, szDecimals);
}

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

  it.each([
    ['3.4567', 20, 1],
    ['3.4567', 40, 1],
    ['2456.7', 25, 4],
    ['118342', 20, 5],
  ] as const)(
    'keeps the realized ROE within one tick of ten percent for entry %s at %sx',
    (entryPrice, leverage, szDecimals) => {
      const { tpTriggerPx, slTriggerPx } = resolveTpSlTriggerPx({
        hasTpsl: true,
        ...buildDefaultTpSlPercent(),
        referencePrice: new BigNumber(entryPrice),
        side: 'long',
        leverage,
        szDecimals,
      });
      const entry = new BigNumber(entryPrice);
      const tickRoe = (getHlPriceTick(entry, szDecimals) ?? new BigNumber(0))
        .dividedBy(entry)
        .multipliedBy(leverage)
        .multipliedBy(100);
      const roeOf = (triggerPx: string) =>
        new BigNumber(triggerPx)
          .minus(entry)
          .dividedBy(entry)
          .multipliedBy(leverage)
          .multipliedBy(100);

      expect(
        roeOf(tpTriggerPx ?? '0')
          .minus(10)
          .abs()
          .lte(tickRoe),
      ).toBe(true);
      expect(
        roeOf(slTriggerPx ?? '0')
          .plus(10)
          .abs()
          .lte(tickRoe),
      ).toBe(true);
    },
  );

  it('rounds percent-derived triggers to the nearest valid price', () => {
    // 3.4567 + 0.5% is 3.4739835: truncation would emit 3.4739 (9.95% ROE).
    expect(
      resolveTpSlTriggerPx({
        hasTpsl: true,
        ...buildDefaultTpSlPercent(),
        referencePrice: new BigNumber('3.4567'),
        side: 'long',
        leverage: 20,
        szDecimals: 1,
      }),
    ).toEqual({ tpTriggerPx: '3.474', slTriggerPx: '3.4394' });
  });

  it('leaves user-entered trigger prices untouched', () => {
    expect(
      resolveTpSlTriggerPx({
        hasTpsl: true,
        tpType: 'price',
        tpValue: '3.4739',
        slType: 'price',
        slValue: '3.4394',
        referencePrice: new BigNumber('3.4567'),
        side: 'long',
        leverage: 20,
        szDecimals: 1,
      }),
    ).toEqual({ tpTriggerPx: '3.4739', slTriggerPx: '3.4394' });
  });

  it.each([
    ['3.4567', 20, 1],
    ['324.6', 20, 2],
    ['118342', 20, 5],
    ['2456.7', 25, 4],
  ] as const)(
    'keeps the seeded price equal to the manual percent path for entry %s',
    (entry, leverage, szDecimals) => {
      const seeded = resolveTpSlTriggerPx({
        hasTpsl: true,
        ...buildDefaultTpSlPercent(),
        referencePrice: new BigNumber(entry),
        side: 'long',
        leverage,
        szDecimals,
      });
      expect(seeded.tpTriggerPx).toBe(
        manualPercentToPrice({
          percent: DEFAULT_TPSL_ROE_PERCENT,
          entry,
          leverage,
          side: 'long',
          isTP: true,
          szDecimals,
        }),
      );
      expect(seeded.slTriggerPx).toBe(
        manualPercentToPrice({
          percent: DEFAULT_TPSL_ROE_PERCENT,
          entry,
          leverage,
          side: 'long',
          isTP: false,
          szDecimals,
        }),
      );
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
