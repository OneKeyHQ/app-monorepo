import { parseValueToNumber, validateLiquidityInput } from './utils';

const validationTests = [
  {
    description: 'empty string',
    input: '',
    should: true,
  },
  {
    description: 'valid number',
    input: '123',
    should: true,
  },
  {
    description: 'invalid decimal number (decimal not allowed)',
    input: '12.5',
    should: false,
  },
  {
    description: 'valid number with lowercase k',
    input: '10k',
    should: true,
  },
  {
    description: 'valid number with uppercase K',
    input: '10K',
    should: true,
  },
  {
    description: 'valid number with lowercase m',
    input: '5m',
    should: true,
  },
  {
    description: 'valid number with uppercase M',
    input: '5M',
    should: true,
  },
  {
    description: 'valid number with lowercase b',
    input: '2b',
    should: true,
  },
  {
    description: 'valid number with uppercase B',
    input: '3B',
    should: true,
  },
  {
    description: 'valid number with lowercase t',
    input: '1t',
    should: true,
  },
  {
    description: 'valid number with uppercase T',
    input: '2T',
    should: true,
  },
  {
    description: 'invalid decimal with k suffix (decimal not allowed)',
    input: '10.5k',
    should: false,
  },
  {
    description: 'invalid decimal with M suffix (decimal not allowed)',
    input: '2.5M',
    should: false,
  },
  {
    description: 'invalid with special character $',
    input: '10$',
    should: false,
  },
  {
    description: 'invalid with special character @',
    input: '5@',
    should: false,
  },
  {
    description: 'invalid with special character #',
    input: '3#k',
    should: false,
  },
  {
    description: 'invalid with special character !',
    input: '2!M',
    should: false,
  },
  {
    description: 'invalid with space',
    input: '10 k',
    should: false,
  },
  {
    description: 'invalid with comma',
    input: '1,000',
    should: false,
  },
  {
    description: 'invalid with dash',
    input: '10-k',
    should: false,
  },
  {
    description: 'invalid with plus sign',
    input: '+10k',
    should: false,
  },
  {
    description: 'invalid with parentheses',
    input: '(10)k',
    should: false,
  },
  {
    description:
      'invalid multiple k/m/b/t characters (only one unit at end allowed)',
    input: 'kMBtKmBT123',
    should: false,
  },
  {
    description: 'invalid only letters (must have numbers)',
    input: 'kmbtKMBT',
    should: false,
  },
  {
    description: 'invalid unit in middle',
    input: '10k5',
    should: false,
  },
  {
    description: 'invalid multiple units',
    input: '10km',
    should: false,
  },
  {
    description: 'valid single unit k only',
    input: 'k',
    should: true,
  },
  {
    description: 'valid single unit M only',
    input: 'M',
    should: true,
  },
];

const parseValueTests = [
  {
    description: 'parse simple number',
    input: '123',
    expected: 123,
  },
  {
    description: 'parse number with lowercase k',
    input: '10k',
    expected: 10_000,
  },
  {
    description: 'parse number with uppercase K',
    input: '10K',
    expected: 10_000,
  },
  {
    description: 'parse number with lowercase m',
    input: '5m',
    expected: 5_000_000,
  },
  {
    description: 'parse number with uppercase M',
    input: '5M',
    expected: 5_000_000,
  },
  {
    description: 'parse number with lowercase b',
    input: '2b',
    expected: 2_000_000_000,
  },
  {
    description: 'parse number with uppercase B',
    input: '3B',
    expected: 3_000_000_000,
  },
  {
    description: 'parse number with lowercase t',
    input: '1t',
    expected: 1_000_000_000_000,
  },
  {
    description: 'parse number with uppercase T',
    input: '2T',
    expected: 2_000_000_000_000,
  },
  {
    description: 'parse single unit k only',
    input: 'k',
    expected: 0,
  },
  {
    description: 'parse single unit M only',
    input: 'M',
    expected: 0,
  },
  {
    description: 'parse very large number with t suffix',
    input: '999t',
    expected: 999_000_000_000_000,
  },
  {
    description: 'parse very large number with b suffix',
    input: '999b',
    expected: 999_000_000_000,
  },
  {
    description: 'parse large number with k suffix',
    input: '999999k',
    expected: 999_999_000,
  },
  {
    description: 'parse empty string',
    input: '',
    expected: 0,
  },
  {
    description: 'parse whitespace only',
    input: '   ',
    expected: 0,
  },
];

describe('Liquidity Input Validation Tests', () => {
  validationTests.forEach((data) => {
    test(data.description, () => {
      const { input, should } = data;
      const result = validateLiquidityInput(input);
      expect(result).toBe(should);
    });
  });
});

describe('Parse Value to Number Tests', () => {
  parseValueTests.forEach((data) => {
    test(data.description, () => {
      const { input, expected } = data;
      const result = parseValueToNumber(input);
      expect(result).toBe(expected);
    });
  });
});
