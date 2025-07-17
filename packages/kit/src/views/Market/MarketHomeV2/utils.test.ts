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
    description: 'valid multiple k/m/b/t characters',
    input: 'kMBtKmBT123',
    should: true,
  },
  {
    description: 'valid only letters',
    input: 'kmbtKMBT',
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
    description: 'parse with special characters removed',
    input: '10$k',
    expected: 10_000,
  },
  {
    description: 'parse with spaces removed',
    input: '10 k',
    expected: 10_000,
  },
  {
    description: 'parse large number with special chars and b suffix',
    input: '5$b',
    expected: 5_000_000_000,
  },
  {
    description: 'parse large number with special chars and t suffix',
    input: '1@t',
    expected: 1_000_000_000_000,
  },
  {
    description: 'parse empty string after cleaning',
    input: '@#$',
    expected: 0,
  },
  {
    description: 'parse only unit letters',
    input: 'kMBT',
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
