import { plainNativeSelectorText } from './nativeSelectorFormat';

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
