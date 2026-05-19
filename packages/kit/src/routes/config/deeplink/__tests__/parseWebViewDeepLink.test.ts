import { parseWebViewDeepLink } from '../parseWebViewDeepLink';

// Avoid the literal `javascript:` URL form to satisfy `no-script-url` lint.
const JS_SCHEME = ['java', 'script:', 'alert(1)'].join('');

// `Linking.parse` (expo-linking) returns query values that are already
// URL-decoded once, so production inputs to `parseWebViewDeepLink` are the
// decoded URL string — NOT the percent-encoded form. Tests pass decoded URLs
// directly to mirror that contract.

describe('parseWebViewDeepLink', () => {
  describe('happy path', () => {
    it('accepts a plain https URL with all flags off by default', () => {
      const result = parseWebViewDeepLink({
        url: 'https://onekey.so',
      });
      expect(result).toEqual({
        url: 'https://onekey.so',
        title: undefined,
        hideHeader: false,
        showAddressBar: false,
        source: 'deeplink',
      });
    });

    it('preserves encoded characters inside the path/query (no second decode)', () => {
      // Signed-URL style: `%2F` in the path must NOT be unescaped to `/`,
      // otherwise the server-side signature check fails.
      const result = parseWebViewDeepLink({
        url: 'https://onekey.so/promo/path%2Fwith%2Fslashes?utm_source=campaign&id=123',
      });
      expect(result?.url).toBe(
        'https://onekey.so/promo/path%2Fwith%2Fslashes?utm_source=campaign&id=123',
      );
    });

    it('decodes title and forwards it', () => {
      const result = parseWebViewDeepLink({
        url: 'https://onekey.so',
        title: '活动',
      });
      expect(result?.title).toBe('活动');
    });

    it('parses hideHeader=1 as true', () => {
      const result = parseWebViewDeepLink({
        url: 'https://onekey.so',
        hideHeader: '1',
      });
      expect(result?.hideHeader).toBe(true);
    });

    it('parses hideHeader=0 as false', () => {
      const result = parseWebViewDeepLink({
        url: 'https://onekey.so',
        hideHeader: '0',
      });
      expect(result?.hideHeader).toBe(false);
    });

    it('parses showAddressBar=1 as true', () => {
      const result = parseWebViewDeepLink({
        url: 'https://onekey.so',
        showAddressBar: '1',
      });
      expect(result?.showAddressBar).toBe(true);
    });

    it('omits title when it is not a string (defends against array coercion)', () => {
      // expo-linking can return string[] for ?title=a&title=b
      const result = parseWebViewDeepLink({
        url: 'https://onekey.so',
        title: ['a', 'b'] as unknown as string,
      });
      expect(result?.title).toBeUndefined();
    });

    it('always tags source as "deeplink"', () => {
      const result = parseWebViewDeepLink({
        url: 'https://onekey.so',
      });
      expect(result?.source).toBe('deeplink');
    });

    it('accepts uppercase HTTPS scheme', () => {
      const result = parseWebViewDeepLink({
        url: 'HTTPS://Onekey.SO',
      });
      expect(result?.url).toBe('HTTPS://Onekey.SO');
    });
  });

  describe('rejection', () => {
    it('rejects http:// scheme (https-only policy)', () => {
      expect(
        parseWebViewDeepLink({
          url: 'http://example.com',
        }),
      ).toBeNull();
    });

    it('rejects uppercase HTTP:// scheme', () => {
      expect(
        parseWebViewDeepLink({
          url: 'HTTP://example.com',
        }),
      ).toBeNull();
    });

    it('rejects userinfo embed (https://user@host)', () => {
      // Classic phishing vector: user reads "trusted.com" but navigation
      // actually goes to "evil.com".
      expect(
        parseWebViewDeepLink({
          url: 'https://trusted.com@evil.com/path',
        }),
      ).toBeNull();
    });

    it('rejects userinfo with password (https://user:pass@host)', () => {
      expect(
        parseWebViewDeepLink({
          url: 'https://user:secret@example.com',
        }),
      ).toBeNull();
    });

    it('rejects empty username with password (https://:pass@host)', () => {
      expect(
        parseWebViewDeepLink({
          url: 'https://:pass@example.com',
        }),
      ).toBeNull();
    });

    it('rejects localhost (delegates to isAllowedWebViewUrl)', () => {
      expect(
        parseWebViewDeepLink({
          url: 'https://localhost:3000/',
        }),
      ).toBeNull();
    });

    it('rejects 127.0.0.1 (delegates to isAllowedWebViewUrl)', () => {
      expect(
        parseWebViewDeepLink({
          url: 'https://127.0.0.1/',
        }),
      ).toBeNull();
    });

    it('rejects AWS metadata 169.254.169.254 (SSRF guard)', () => {
      expect(
        parseWebViewDeepLink({
          url: 'https://169.254.169.254/',
        }),
      ).toBeNull();
    });

    it('rejects javascript: scheme', () => {
      // Percent-encoded scheme smuggling (e.g. starting with %6A) is already
      // unescaped by expo-linking before we receive `query.url`, so by the
      // time it reaches this function it looks like the plain decoded form
      // tested here.
      expect(parseWebViewDeepLink({ url: JS_SCHEME })).toBeNull();
    });

    it('rejects file: scheme', () => {
      expect(parseWebViewDeepLink({ url: 'file:///etc/passwd' })).toBeNull();
    });

    it('rejects data: scheme', () => {
      expect(
        parseWebViewDeepLink({
          url: 'data:text/html,<script>alert(1)</script>',
        }),
      ).toBeNull();
    });

    it('rejects about: scheme', () => {
      expect(parseWebViewDeepLink({ url: 'about:blank' })).toBeNull();
    });

    it('rejects intent: scheme', () => {
      expect(
        parseWebViewDeepLink({
          url: 'intent://example.com#Intent;end',
        }),
      ).toBeNull();
    });

    it('rejects empty string url', () => {
      expect(parseWebViewDeepLink({ url: '' })).toBeNull();
    });

    it('rejects array-typed url (?url=a&url=b coercion)', () => {
      expect(
        parseWebViewDeepLink({
          url: ['a', 'b'] as unknown as string,
        }),
      ).toBeNull();
    });

    it('rejects undefined url', () => {
      expect(
        parseWebViewDeepLink({
          url: undefined as unknown as string,
        }),
      ).toBeNull();
    });

    it('rejects URL longer than 2048 characters', () => {
      const longTail = 'a'.repeat(2050);
      expect(
        parseWebViewDeepLink({
          url: `https://example.com/${longTail}`,
        }),
      ).toBeNull();
    });

    it('accepts URL exactly at the 2048-character boundary', () => {
      // 'https://x/' is 10 chars; pad path so total decoded length is 2048
      const padding = 'a'.repeat(2048 - 10);
      const url = `https://x/${padding}`;
      expect(url.length).toBe(2048);
      const result = parseWebViewDeepLink({ url });
      expect(result?.url).toBe(url);
    });

    it('rejects localhost FQDN form (trailing dot)', () => {
      // `https://localhost./` resolves to the same loopback as `localhost`,
      // so the safety policy must catch the trailing-dot variant too.
      expect(parseWebViewDeepLink({ url: 'https://localhost./' })).toBeNull();
    });
  });
});
