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
    description: 'valid decimal number',
    input: '12.5',
    should: true,
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
    description: 'valid decimal with k suffix',
    input: '10.5k',
    should: true,
  },
  {
    description: 'valid decimal with M suffix',
    input: '2.5M',
    should: true,
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
    description: 'valid multiple k/m characters',
    input: 'kMKm123',
    should: true,
  },
  {
    description: 'valid only letters',
    input: 'kmKM',
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
    description: 'parse decimal number',
    input: '12.5',
    expected: 12.5,
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
    description: 'parse decimal with k suffix',
    input: '10.5k',
    expected: 10_500,
  },
  {
    description: 'parse decimal with M suffix',
    input: '2.5M',
    expected: 2_500_000,
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
