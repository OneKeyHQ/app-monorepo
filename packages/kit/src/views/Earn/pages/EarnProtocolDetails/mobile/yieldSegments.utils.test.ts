import {
  buildHeadlineApyParts,
  buildYieldSegments,
  formatCountdown,
  isYieldSheetAvailable,
} from './yieldSegments.utils';

describe('isYieldSheetAvailable', () => {
  const summary = {
    totalApy: { title: { text: 'Total APY' }, description: { text: '7.22%' } },
  };

  it('requires both the header and a fully classified item list', () => {
    expect(
      isYieldSheetAvailable({
        yieldSummary: summary,
        items: [
          {
            title: { text: 'Base' },
            value: '+6.10%',
            kind: 'base',
            rate: '6.10',
          },
        ],
      }),
    ).toBe(true);
  });

  it('rejects a partially classified list', () => {
    expect(
      isYieldSheetAvailable({
        yieldSummary: summary,
        items: [
          {
            title: { text: 'Base' },
            value: '+6.10%',
            kind: 'base',
            rate: '6.10',
          },
          { title: { text: 'Points' }, value: 'BW points' },
        ],
      }),
    ).toBe(false);
  });

  it('rejects a payload without the header', () => {
    expect(
      isYieldSheetAvailable({
        items: [
          {
            title: { text: 'Base' },
            value: '+6.10%',
            kind: 'base',
            rate: '6.10',
          },
        ],
      }),
    ).toBe(false);
    expect(isYieldSheetAvailable(undefined)).toBe(false);
  });
});

describe('buildYieldSegments', () => {
  it('keeps yield rows and drops the fee row', () => {
    expect(
      buildYieldSegments([
        {
          title: { text: 'Base' },
          value: '+6.10%',
          kind: 'base',
          rate: '6.10',
          color: '$a',
        },
        {
          title: { text: 'Bonus' },
          value: '+2.12%',
          kind: 'campaign',
          rate: '2.12',
          color: '$b',
        },
        { title: { text: 'Fee' }, value: '-1.00%', kind: 'fee', rate: '-1.00' },
      ]),
    ).toEqual([
      { color: '$a', weight: 6.1 },
      { color: '$b', weight: 2.12 },
    ]);
  });

  it('drops zero and negative rows so they cannot invert the bar', () => {
    expect(
      buildYieldSegments([
        { title: { text: 'Base' }, value: '0.00%', kind: 'base', rate: '0' },
        { title: { text: 'Odd' }, value: '-1.00%', kind: 'reward', rate: '-1' },
      ]),
    ).toEqual([]);
  });

  it('falls back to a neutral color when the server sends none', () => {
    expect(
      buildYieldSegments([
        { title: { text: 'Base' }, value: '+1.00%', kind: 'base', rate: '1' },
      ]),
    ).toEqual([{ color: '$bgSubdued', weight: 1 }]);
  });

  it('returns nothing for an empty list', () => {
    expect(buildYieldSegments(undefined)).toEqual([]);
    expect(buildYieldSegments([])).toEqual([]);
  });
});

describe('formatCountdown', () => {
  it('breaks the remainder into d/h/m/s', () => {
    const oneDay = 24 * 3600 * 1000;
    expect(
      formatCountdown(9 * oneDay + 12 * 3_600_000 + 23 * 60_000 + 12_000),
    ).toEqual({
      days: 9,
      hours: 12,
      minutes: 23,
      seconds: 12,
    });
  });

  it('returns null once the campaign is over', () => {
    expect(formatCountdown(0)).toBeNull();
    expect(formatCountdown(-1)).toBeNull();
    expect(formatCountdown(Number.NaN)).toBeNull();
  });
});

describe('buildHeadlineApyParts', () => {
  it('splits base and bonus the way the design draws them', () => {
    expect(
      buildHeadlineApyParts([
        { kind: 'base', rate: '5.10', color: '$textSuccess' },
        { kind: 'campaign', rate: '2.12', color: '$textCaution' },
        { kind: 'fee', rate: '-1.00' },
      ] as any),
    ).toEqual({
      base: '5.10%',
      bonus: '+2.12%',
      bonusColor: '$textCaution',
    });
  });

  it('sums several bonus rows into one figure', () => {
    expect(
      buildHeadlineApyParts([
        { kind: 'base', rate: '3.52', color: '$textSuccess' },
        { kind: 'campaign', rate: '20', color: '$textCaution' },
        { kind: 'reward', rate: '1.5', color: '$textInfo' },
      ] as any),
    ).toMatchObject({ base: '3.52%', bonus: '+21.50%' });
  });

  it('keeps the reward color when there is no campaign', () => {
    expect(
      buildHeadlineApyParts([
        { kind: 'base', rate: '6.10', color: '$textSuccess' },
        { kind: 'reward', rate: '2.12', color: '$textInfo' },
      ] as any),
    ).toMatchObject({ bonusColor: '$textInfo' });
  });

  it('lets the campaign color win when both are present', () => {
    expect(
      buildHeadlineApyParts([
        { kind: 'base', rate: '1', color: '$textSuccess' },
        { kind: 'reward', rate: '1', color: '$textInfo' },
        { kind: 'campaign', rate: '1', color: '$textCaution' },
      ] as any),
    ).toMatchObject({ bonusColor: '$textCaution' });
  });

  it('drops the bonus half when there is none', () => {
    expect(
      buildHeadlineApyParts([
        { kind: 'base', rate: '4.00', color: '$textSuccess' },
        { kind: 'fee', rate: '-0.5' },
      ] as any),
    ).toEqual({ base: '4.00%' });
  });

  it('gives up when the breakdown has no base row', () => {
    expect(
      buildHeadlineApyParts([{ kind: 'campaign', rate: '2' }] as any),
    ).toBeUndefined();
    expect(buildHeadlineApyParts([])).toBeUndefined();
    expect(buildHeadlineApyParts(undefined)).toBeUndefined();
  });
});
