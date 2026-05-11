import platformEnv from '../platformEnv';

import uriUtils, {
  buildGoogleSearchUrl,
  containsPunycode,
  ensureHttpPrefix,
  ensureHttpsPrefix,
  isLocalhostUrl,
  isUrlWithoutProtocol,
  parseUrl,
  validateUrl,
} from './uriUtils';

describe('buildUrl', () => {
  test('omits undefined/null query params (does not serialize to literal "undefined")', () => {
    const url = uriUtils.buildUrl({
      protocol: 'onekey-wallet',
      path: 'invited_by_friend',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      query: { code: 'abc', page: undefined } as any,
    });
    expect(url).toBe('onekey-wallet://invited_by_friend?code=abc');
  });
});

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

  test('allows HTTP localhost only when explicitly enabled', () => {
    const testCases = [
      {
        input: 'http://localhost:3000/path?query=value',
        expected: 'http://localhost:3000/path?query=value',
      },
      { input: 'http://127.0.0.1:5173/', expected: 'http://127.0.0.1:5173/' },
      { input: 'localhost', expected: 'http://localhost' },
      { input: 'localhost:3000', expected: 'http://localhost:3000' },
      { input: '127.0.0.1:5173', expected: 'http://127.0.0.1:5173' },
      { input: '[::1]:5173', expected: 'http://[::1]:5173' },
    ];
    testCases.forEach(({ input, expected }) => {
      expect(validateUrl(input)).not.toBe(expected);
      expect(validateUrl(input, { allowLocalhostUrl: true })).toBe(expected);
    });
  });
});

describe('parseDappRedirect', () => {
  test('allows localhost redirects only when explicitly enabled', () => {
    const localUrls = [
      'http://localhost:3000',
      'http://127.0.0.1:5173',
      'http://[::1]:5173',
    ];
    localUrls.forEach((url) => {
      expect(uriUtils.parseDappRedirect(url, []).action).toBe(
        uriUtils.EDAppOpenActionEnum.DENY,
      );
      expect(
        uriUtils.parseDappRedirect(url, [], {
          allowLocalhostUrl: true,
        }).action,
      ).toBe(uriUtils.EDAppOpenActionEnum.ALLOW);
    });
  });

  test('does not bypass protocol checks for localhost redirects', () => {
    ['ftp://localhost', 'file://127.0.0.1'].forEach((url) => {
      expect(
        uriUtils.parseDappRedirect(url, [], {
          allowLocalhostUrl: true,
        }).action,
      ).toBe(uriUtils.EDAppOpenActionEnum.DENY);
    });
  });
});

describe('isLocalhostUrl', () => {
  test('matches localhost and 127.0.0.1 inputs with or without protocol', () => {
    [
      'localhost',
      'localhost:3000',
      'http://localhost:3000/path',
      '127.0.0.1',
      '127.0.0.1:5173',
      'http://127.0.0.1:5173/',
      '[::1]:5173',
      'http://[::1]:5173/',
    ].forEach((url) => {
      expect(isLocalhostUrl(url)).toBe(true);
    });
  });

  test('rejects non-localhost hostnames', () => {
    [
      'localhost.com',
      'example.com',
      'http://example.com/localhost',
      'search query',
      'http://',
    ].forEach((url) => {
      expect(isLocalhostUrl(url)).toBe(false);
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

describe('ensureHttpPrefix', () => {
  test('returns URL unchanged if it already has a protocol', () => {
    expect(ensureHttpPrefix('http://localhost:3000')).toBe(
      'http://localhost:3000',
    );
    expect(ensureHttpPrefix('https://example.com')).toBe('https://example.com');
    expect(ensureHttpPrefix('onekey-wallet:account/list')).toBe(
      'onekey-wallet:account/list',
    );
    expect(ensureHttpPrefix('mailto:test@example.com')).toBe(
      'mailto:test@example.com',
    );
  });

  test('adds http:// prefix to URL-like text without protocol', () => {
    expect(ensureHttpPrefix('localhost:3000')).toBe('http://localhost:3000');
  });
});

describe('buildGoogleSearchUrl', () => {
  test('builds an explicit Google search URL for localhost keywords', () => {
    expect(buildGoogleSearchUrl('http://localhost:3000')).toBe(
      'https://www.google.com/search?q=http%3A%2F%2Flocalhost%3A3000',
    );
  });
});

describe('parseUrl', () => {
  test('parses standard https URLs correctly', () => {
    const result = parseUrl('https://example.com/path?q=1');
    expect(result).toMatchObject({
      hostname: 'example.com',
      pathname: '/path',
      urlSchema: 'https',
    });
  });

  test('normalizes custom scheme URLs where hostname is empty', () => {
    // Hermes URL parser returns hostname='' and pathname='//host/path'
    // for custom schemes; this tests the normalization logic
    const result = parseUrl('onekey-wallet://account/list');
    expect(result).toMatchObject({
      hostname: 'account',
      pathname: '/list',
      urlSchema: 'onekey-wallet',
    });
  });

  test('normalizes custom scheme URLs with no path', () => {
    const result = parseUrl('onekey-wallet://account');
    expect(result).toMatchObject({
      hostname: 'account',
      urlSchema: 'onekey-wallet',
    });
    // V8 returns pathname='' for custom schemes without a path,
    // Hermes normalization produces pathname='/' via the fallback branch.
    // Accept either to keep the test cross-engine compatible.
    expect(['', '/']).toContain(result?.pathname);
  });

  test('normalizes origin to null for non-http schemes', () => {
    const result = parseUrl('onekey-wallet://account/list');
    expect(result?.origin).toBe('null');
  });

  test('preserves origin for http/https schemes', () => {
    const result = parseUrl('https://example.com/path');
    expect(result?.origin).toBe('https://example.com');
  });

  test('builds urlPathList correctly for custom schemes', () => {
    const result = parseUrl('onekey-wallet://account/list');
    expect(result?.urlPathList).toEqual(['account', 'list']);
  });

  test('returns null for invalid URLs', () => {
    expect(parseUrl('not a url')).toBeNull();
  });
});

describe('validateUrl trailing slash handling', () => {
  test('strips root-only trailing slash', () => {
    // Root-only path: https://google.com/ -> https://google.com
    expect(validateUrl('https://google.com/')).toBe('https://google.com');
  });

  test('trailing slash on deeper paths depends on platform', () => {
    // On native (Hermes), trailing slashes are stripped (Hermes URL parser quirk).
    // On Node/web, trailing slashes are preserved (semantically meaningful).
    const expected = platformEnv.isNative
      ? 'https://example.com/path'
      : 'https://example.com/path/';
    expect(validateUrl('https://example.com/path/')).toBe(expected);
  });

  test('preserves paths without trailing slash', () => {
    expect(validateUrl('https://example.com/path')).toBe(
      'https://example.com/path',
    );
  });

  test('query params and hash after normalization', () => {
    const expected = platformEnv.isNative
      ? 'https://example.com/path?q=1#hash'
      : 'https://example.com/path/?q=1#hash';
    expect(validateUrl('https://example.com/path/?q=1#hash')).toBe(expected);
  });
});

describe('containsPunycode', () => {
  test('detects unicode hostnames (Hermes keeps unicode, V8 normalizes to xn--)', () => {
    // xn-- prefixed domains
    expect(containsPunycode('http://xn--fiq228c.com')).toBe(true);
    // Unicode domains
    expect(containsPunycode('https://аррӏе.com')).toBe(true);
    expect(containsPunycode('https://新华网.cn')).toBe(true);
  });

  test('returns false for plain ASCII domains', () => {
    expect(containsPunycode('https://google.com')).toBe(false);
    expect(containsPunycode('https://example.co.uk')).toBe(false);
  });
});
