import {
  getStockMarketClosedDescription,
  stripTrailingSentencePunctuation,
} from './getStockMarketClosedDescription';

describe('getStockMarketClosedDescription', () => {
  it('returns the first non-empty line', () => {
    expect(
      getStockMarketClosedDescription('Reopens in 2h\nProvider description'),
    ).toBe('Reopens in 2h');
    expect(getStockMarketClosedDescription('\n\n  Reopens in 2h  \nrest')).toBe(
      'Reopens in 2h',
    );
  });

  it('treats empty or ondo blurbs as no countdown', () => {
    expect(getStockMarketClosedDescription(undefined)).toBeUndefined();
    expect(getStockMarketClosedDescription('')).toBeUndefined();
    expect(
      getStockMarketClosedDescription('Ondo tokenized stocks trade 7x24'),
    ).toBeUndefined();
  });
});

describe('stripTrailingSentencePunctuation', () => {
  it('strips CJK and Latin sentence-ending punctuation (OK-58554)', () => {
    expect(
      stripTrailingSentencePunctuation('该股票目前停牌，暂时无法交易。'),
    ).toBe('该股票目前停牌，暂时无法交易');
    expect(
      stripTrailingSentencePunctuation(
        'This stock is currently halted and cannot be traded.',
      ),
    ).toBe('This stock is currently halted and cannot be traded');
  });

  it('keeps countdown lines without trailing punctuation unchanged', () => {
    expect(
      stripTrailingSentencePunctuation('美国股票市场将于 9h 24m 后开盘'),
    ).toBe('美国股票市场将于 9h 24m 后开盘');
    expect(stripTrailingSentencePunctuation('Reopens in 2h')).toBe(
      'Reopens in 2h',
    );
  });
});
