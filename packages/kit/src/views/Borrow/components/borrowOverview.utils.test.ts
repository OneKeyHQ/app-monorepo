import {
  withNetApyLossColor,
  withNetApySignColor,
} from './borrowOverview.utils';

describe('withNetApySignColor', () => {
  it.each([
    ['1.43%', '$textSuccess'],
    ['-0.52%', '$textCritical'],
    ['<0.01%', '$textSuccess'],
    ['>-0.01%', '$textCritical'],
    ['-1,234.56%', '$textCritical'],
  ])('derives the color for %s', (text, expected) => {
    expect(withNetApySignColor({ text })?.color).toBe(expected);
  });

  it.each([{ text: '0.00%' }, { text: '-', color: '$textSubdued' }] as const)(
    'keeps neutral server text unchanged',
    (value) => {
      expect(withNetApySignColor(value)).toEqual(value);
    },
  );

  it('passes through when there is no net APY at all', () => {
    expect(withNetApySignColor(undefined)).toBeUndefined();
  });
});

describe('withNetApyLossColor', () => {
  it('colors a loss only', () => {
    expect(withNetApyLossColor({ text: '-1.75%' })?.color).toBe(
      '$textCritical',
    );
    expect(withNetApyLossColor({ text: '3.03%' })).toEqual({ text: '3.03%' });
    expect(withNetApyLossColor({ text: '0.00%' })).toEqual({ text: '0.00%' });
  });

  it('keeps a missing value missing', () => {
    expect(withNetApyLossColor(undefined)).toBeUndefined();
  });
});
