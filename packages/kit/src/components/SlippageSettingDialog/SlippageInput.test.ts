import { formatSlippageInputDisplayValue } from './SlippageInput';

describe('formatSlippageInputDisplayValue', () => {
  it('keeps empty custom slippage input blank while editing', () => {
    expect(formatSlippageInputDisplayValue(undefined)).toBe('');
  });

  it('formats numeric slippage with swap precision', () => {
    expect(formatSlippageInputDisplayValue(0.555)).toBe('0.55');
  });
});
