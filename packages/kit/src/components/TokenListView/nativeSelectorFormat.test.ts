import {
  formatNativeSelectorPriceChange,
  plainNativeSelectorText,
} from './nativeSelectorFormat';

describe('plainNativeSelectorText', () => {
  it('spells the subscript zero count out again', () => {
    expect(
      plainNativeSelectorText({
        text: '$0.05147',
        segments: [
          { text: '$0.0' },
          { text: '5', style: 'subscript' },
          { text: '147' },
        ],
      }),
    ).toBe('$0.00000147');
  });

  it('keeps text without a subscript as is', () => {
    expect(
      plainNativeSelectorText({ text: '+0.1807 sUSDu', segments: undefined }),
    ).toBe('+0.1807 sUSDu');
  });
});

describe('formatNativeSelectorPriceChange', () => {
  it('signs and colors a change that shows as one', () => {
    expect(formatNativeSelectorPriceChange(1.82)).toMatchObject({
      text: '+1.82%',
      tone: 'positive',
    });
    expect(formatNativeSelectorPriceChange(-1.12)).toMatchObject({
      text: '-1.12%',
      tone: 'negative',
    });
    expect(formatNativeSelectorPriceChange(0.006)).toMatchObject({
      text: '+0.01%',
      tone: 'positive',
    });
  });

  it('shows a change that rounds to zero as no change', () => {
    for (const value of [0, 0.004, -0.004, -0.0001]) {
      expect(formatNativeSelectorPriceChange(value)).toMatchObject({
        text: '0.00%',
        tone: 'secondary',
      });
    }
  });
});
