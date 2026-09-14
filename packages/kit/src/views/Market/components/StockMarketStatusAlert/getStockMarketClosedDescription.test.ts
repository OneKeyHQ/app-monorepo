// `getStockMarketClosedDescription` itself is covered by
// SwapStockTradeAlert.utils.test.ts — only the strip helper is tested here.
import { stripTrailingSentencePunctuation } from './getStockMarketClosedDescription';

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
    expect(stripTrailingSentencePunctuation('Reopens in 2h')).toBe(
      'Reopens in 2h',
    );
  });
});
