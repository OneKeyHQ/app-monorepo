import { sanitizeAmountInputText } from './amountInputTextUtils';

const SANITIZE_CASES: Array<[string, string, string]> = [
  ['empty input', '', ''],
  ['plain integer', '1234', '1234'],
  ['letters inside digits', '1a234g', '1234'],
  ['letters around a leading decimal', 'a.5g', '0.5'],
  ['letters only', 'abc', ''],
  ['negative marker', '-1.2', '1.2'],
  ['spaces inside digits', ' 1 2 . 3 ', '12.3'],
  ['redundant integer zeros', '000123', '123'],
  ['redundant decimal zeros', '000.12', '0.12'],
  ['leading decimal', '.5', '0.5'],
  ['consecutive leading decimals', '..5', '0.5'],
  ['consecutive decimals', '1..23', '1.23'],
  ['multiple separated decimals', '1.2.3', '1.23'],
  ['mixed decimal separators', '1，2。3', '1.23'],
  ['comma-leading decimal', ',5', '0.5'],
];

describe('sanitizeAmountInputText', () => {
  it.each(SANITIZE_CASES)('%s', (_name, input, expected) => {
    expect(sanitizeAmountInputText(input)).toBe(expected);
  });

  it('preserves delete followed by additional digits', () => {
    const nativeValues = [
      '1',
      '12',
      '123',
      '1234',
      '123',
      '1235',
      '12356',
      '123567',
    ];

    expect(nativeValues.map(sanitizeAmountInputText)).toEqual(nativeValues);
  });

  it('collapses repeated decimals throughout a typing sequence', () => {
    const nativeValues = ['1', '1.', '1..', '1..2', '1..23'];

    expect(nativeValues.map(sanitizeAmountInputText)).toEqual([
      '1',
      '1.',
      '1.',
      '1.2',
      '1.23',
    ]);
  });
});
