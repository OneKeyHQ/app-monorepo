import { containsPunycode } from './uriUtils';

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
