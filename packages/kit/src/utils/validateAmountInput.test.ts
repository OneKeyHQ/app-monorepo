import { validateAmountInput } from './validateAmountInput';

describe('validateAmountInput', () => {
  it.each(['', '0', '0.', '0.12', '1', '1.', '1234', '1234.56'])(
    'accepts canonical input %p',
    (input) => {
      expect(validateAmountInput(input, 2)).toBe(true);
    },
  );

  it.each(['.5', '01', '1a234g', '1..23', '-1', '1,2', '1.234'])(
    'rejects non-canonical input %p',
    (input) => {
      expect(validateAmountInput(input, 2)).toBe(false);
    },
  );

  it('uses six decimal places by default', () => {
    expect(validateAmountInput('1.123456')).toBe(true);
    expect(validateAmountInput('1.1234567')).toBe(false);
  });
});
