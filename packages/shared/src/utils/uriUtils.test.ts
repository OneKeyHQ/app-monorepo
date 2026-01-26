import {
  containsPunycode,
  ensureHttpsPrefix,
  isUrlWithoutProtocol,
  validateUrl,
} from './uriUtils';

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
    const completeUrls = [
      'https://google.com',
      'https://github.com/user/repo',
      'https://web3.okx.com/token/ethereum?cg=1&lmi=all&rb=6&vmi=all',
    ];
    completeUrls.forEach((url) => {
      expect(validateUrl(url)).toBe(url);
    });
  });

  test('adds https prefix for valid domain names', () => {
    const testCases = [
      { input: 'http://a.com', expected: 'https://a.com' },
      { input: 'https://a.com', expected: 'https://a.com' },
      { input: 'https://a.com/path', expected: 'https://a.com/path' },
      {
        input: 'https://a.com/path?query=value',
        expected: 'https://a.com/path?query=value',
      },
      {
        input: 'https://a.com/path?query=value#hash',
        expected: 'https://a.com/path?query=value#hash',
      },
      {
        input: 'https://a.com/path?query=value#hash',
        expected: 'https://a.com/path?query=value#hash',
      },
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
    ];
    invalidInputs.forEach((input) => {
      const result = validateUrl(input);
      expect(result).toBe(
        `https://www.google.com/search?q=${encodeURIComponent(input)}`,
      );
    });
  });
});

describe('isUrlWithoutProtocol', () => {
  test('returns true for valid URLs without protocol', () => {
    const validUrls = [
      'onekey.so',
      'onekey.so/invite/ABC123',
      'www.google.com',
      'www.example.com/path/to/page',
      'sub.domain.example.com',
      'example.co.uk',
    ];
    validUrls.forEach((url) => {
      expect(isUrlWithoutProtocol(url)).toBe(true);
    });
  });

  test('returns false for URLs with protocol', () => {
    const urlsWithProtocol = [
      'https://onekey.so',
      'http://google.com',
      'https://www.example.com/path',
    ];
    urlsWithProtocol.forEach((url) => {
      expect(isUrlWithoutProtocol(url)).toBe(false);
    });
  });

  test('returns false for invalid inputs', () => {
    const invalidInputs = [
      'just text',
      'hello world',
      'ABC123',
      'localhost',
      '',
    ];
    invalidInputs.forEach((input) => {
      expect(isUrlWithoutProtocol(input)).toBe(false);
    });
  });
});

describe('ensureHttpsPrefix', () => {
  test('returns URL unchanged if already has https://', () => {
    const httpsUrls = [
      'https://onekey.so',
      'https://www.google.com/search',
      'https://example.com/path?query=value',
    ];
    httpsUrls.forEach((url) => {
      expect(ensureHttpsPrefix(url)).toBe(url);
    });
  });

  test('returns URL unchanged if already has http://', () => {
    const httpUrls = ['http://onekey.so', 'http://www.google.com'];
    httpUrls.forEach((url) => {
      expect(ensureHttpsPrefix(url)).toBe(url);
    });
  });

  test('adds https:// prefix to valid URLs without protocol', () => {
    const testCases = [
      { input: 'onekey.so', expected: 'https://onekey.so' },
      {
        input: 'onekey.so/invite/ABC123',
        expected: 'https://onekey.so/invite/ABC123',
      },
      { input: 'www.google.com', expected: 'https://www.google.com' },
      { input: 'example.co.uk/path', expected: 'https://example.co.uk/path' },
    ];
    testCases.forEach(({ input, expected }) => {
      expect(ensureHttpsPrefix(input)).toBe(expected);
    });
  });

  test('returns input unchanged for non-URL text', () => {
    const nonUrls = ['ABC123', 'just text', 'hello world', 'localhost'];
    nonUrls.forEach((input) => {
      expect(ensureHttpsPrefix(input)).toBe(input);
    });
  });

  test('returns empty string for empty input', () => {
    expect(ensureHttpsPrefix('')).toBe('');
  });
});
