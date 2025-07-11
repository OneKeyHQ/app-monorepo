import { containsPunycode, validateUrl } from './uriUtils';

describe('Punycode detection', () => {
  test('detects Punycode in URL', () => {
    const urlsWithPunycode = [
      'https://аррӏе.com',
      'https://新华网.cn',
      'https://中资源.com',
      'http://xn--s7y.co',
    ];
    expect(urlsWithPunycode.every((url) => containsPunycode(url))).toBeTruthy();
  });

  test('does not falsely detect Punycode in ASCII URL', () => {
    const asciiUrls = [
      'https://www.npmjs.com/package/punycode',
      'http://example.com',
      'https://github.com/mathiasbynens/punycode.js/pulls?q=is%3Apr+is%3Aclosed',
      'https://github.com/OneKeyHQ/app-monorepo/pulls?q=is%3Apr+is%3Aclosed',
      'https://github.com/OneKeyHQ/app-monorepo/pulls?q=is%3Apr+is%3Aclose',
    ];
    expect(asciiUrls.every((url) => containsPunycode(url))).toBeFalsy();
  });

  test('detects Punycode in URL with mixed characters', () => {
    const mixedUrls = ['http://xn--fiq228c.com', 'xn--maana-pta.com'];
    expect(mixedUrls.every((url) => containsPunycode(url))).toBeTruthy();
  });

  test('handles URLs without protocol', () => {
    const urlWithoutProtocol = 'xn--s7y.co';
    expect(containsPunycode(urlWithoutProtocol)).toBeTruthy();
  });

  test('returns false for malformed URL', () => {
    const malformedUrl = 'ht!tp://xn--s7y.co';
    expect(containsPunycode(malformedUrl)).toBeFalsy();
  });
});

describe('validateUrl', () => {
  test('returns original URL for complete URLs', () => {
    const completeUrls = ['https://google.com', 'https://github.com/user/repo'];
    completeUrls.forEach((url) => {
      expect(validateUrl(url)).toBe(url);
    });
  });

  test('adds https prefix for valid domain names', () => {
    const testCases = [
      { input: 'google.com', expected: 'https://google.com' },
      { input: 'baidu.cn', expected: 'https://baidu.cn' },
      { input: 'example.co.uk', expected: 'https://example.co.uk' },
      { input: 'sub.domain.org', expected: 'https://sub.domain.org' },
    ];
    testCases.forEach(({ input, expected }) => {
      expect(validateUrl(input)).toBe(expected);
    });
  });

  test('returns Google search URL for invalid inputs', () => {
    const invalidInputs = [
      'search query',
      'how to code',
      'localhost',
      'just text',
      'test',
      'http://test.com',
    ];
    invalidInputs.forEach((input) => {
      const result = validateUrl(input);
      expect(result).toBe(
        `https://www.google.com/search?q=${encodeURIComponent(input)}`,
      );
    });
  });
});
