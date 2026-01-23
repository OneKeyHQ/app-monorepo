import stringUtils, { stableStringify } from './stringUtils';

test('stableStringify', () => {
  expect(stableStringify({ a: '1', b: '2' })).toBe(
    stableStringify({ b: '2', a: '1' }),
  );
});

describe('isValidEmail', () => {
  it('should return true for valid ASCII domain emails', () => {
    expect(stringUtils.isValidEmail('test@example.com')).toBe(true);
    expect(stringUtils.isValidEmail('user.name@domain.org')).toBe(true);
    expect(stringUtils.isValidEmail('user+tag@gmail.com')).toBe(true);
    expect(stringUtils.isValidEmail('a@b.co')).toBe(true);
  });

  it('should return false for emails with Chinese domains', () => {
    expect(stringUtils.isValidEmail('test@中文.com')).toBe(false);
    expect(stringUtils.isValidEmail('test@邮箱.中国')).toBe(false);
    expect(stringUtils.isValidEmail('user@测试.org')).toBe(false);
  });

  it('should return false for emails with other non-ASCII domains', () => {
    expect(stringUtils.isValidEmail('test@日本語.jp')).toBe(false);
    expect(stringUtils.isValidEmail('test@한국어.kr')).toBe(false);
    expect(stringUtils.isValidEmail('test@münchen.de')).toBe(false);
  });

  it('should return false for invalid email formats', () => {
    expect(stringUtils.isValidEmail('')).toBe(false);
    expect(stringUtils.isValidEmail('notanemail')).toBe(false);
    expect(stringUtils.isValidEmail('@nodomain.com')).toBe(false);
    expect(stringUtils.isValidEmail('noat.com')).toBe(false);
  });

  it('should return false for null or undefined', () => {
    expect(stringUtils.isValidEmail(null as unknown as string)).toBe(false);
    expect(stringUtils.isValidEmail(undefined as unknown as string)).toBe(
      false,
    );
  });
});
