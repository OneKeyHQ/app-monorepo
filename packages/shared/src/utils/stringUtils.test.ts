import stringUtils, { stableStringify } from './stringUtils';

test('stableStringify', () => {
  expect(stableStringify({ a: '1', b: '2' })).toBe(
    stableStringify({ b: '2', a: '1' }),
  );
});

describe('isValidEmail', () => {
  test('should accept valid ASCII domain emails', () => {
    expect(stringUtils.isValidEmail('test@example.com')).toBe(true);
    expect(stringUtils.isValidEmail('user@gmail.com')).toBe(true);
    expect(stringUtils.isValidEmail('hello.world@sub.domain.org')).toBe(true);
    expect(stringUtils.isValidEmail('user+tag@example.co.uk')).toBe(true);
  });

  test('should reject emails with IDN domains (non-ASCII)', () => {
    expect(stringUtils.isValidEmail('test@中文.com')).toBe(false);
    expect(stringUtils.isValidEmail('test@例え.jp')).toBe(false);
    expect(stringUtils.isValidEmail('test@домен.рф')).toBe(false);
    expect(stringUtils.isValidEmail('user@münchen.de')).toBe(false);
  });

  test('should reject invalid emails', () => {
    expect(stringUtils.isValidEmail('')).toBe(false);
    expect(stringUtils.isValidEmail('invalid')).toBe(false);
    expect(stringUtils.isValidEmail('no@domain')).toBe(false);
    expect(stringUtils.isValidEmail('@example.com')).toBe(false);
    expect(stringUtils.isValidEmail('test@')).toBe(false);
  });

  test('should handle edge cases', () => {
    expect(stringUtils.isValidEmail(null as unknown as string)).toBe(false);
    expect(stringUtils.isValidEmail(undefined as unknown as string)).toBe(
      false,
    );
    expect(stringUtils.isValidEmail(123 as unknown as string)).toBe(false);
  });
});
