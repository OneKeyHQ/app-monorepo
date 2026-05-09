import { parseWebViewDeepLink } from '../parseWebViewDeepLink';

// Avoid the literal `javascript:` URL form to satisfy `no-script-url` lint.
const JS_SCHEME = ['java', 'script:', 'alert(1)'].join('');

describe('parseWebViewDeepLink', () => {
  describe('happy path', () => {
    it('accepts a plain https URL with all flags off by default', () => {
      const result = parseWebViewDeepLink({
        url: encodeURIComponent('https://onekey.so'),
      });
      expect(result).toEqual({
        url: 'https://onekey.so',
        title: undefined,
        hideHeader: false,
        showAddressBar: false,
        source: 'deeplink',
      });
    });

    it('accepts http URL (not just https)', () => {
      const result = parseWebViewDeepLink({
        url: encodeURIComponent('http://example.com'),
      });
      expect(result?.url).toBe('http://example.com');
    });

    it('decodes percent-encoded query strings inside the URL', () => {
      const result = parseWebViewDeepLink({
        url: encodeURIComponent(
          'https://onekey.so/promo?utm_source=campaign&id=123',
        ),
      });
      expect(result?.url).toBe(
        'https://onekey.so/promo?utm_source=campaign&id=123',
      );
    });

    it('decodes title and forwards it', () => {
      const result = parseWebViewDeepLink({
        url: encodeURIComponent('https://onekey.so'),
        title: '活动',
      });
      expect(result?.title).toBe('活动');
    });

    it('parses hideHeader=1 as true', () => {
      const result = parseWebViewDeepLink({
        url: encodeURIComponent('https://onekey.so'),
        hideHeader: '1',
      });
      expect(result?.hideHeader).toBe(true);
    });

    it('parses hideHeader=0 as false', () => {
      const result = parseWebViewDeepLink({
        url: encodeURIComponent('https://onekey.so'),
        hideHeader: '0',
      });
      expect(result?.hideHeader).toBe(false);
    });

    it('parses showAddressBar=1 as true', () => {
      const result = parseWebViewDeepLink({
        url: encodeURIComponent('https://onekey.so'),
        showAddressBar: '1',
      });
      expect(result?.showAddressBar).toBe(true);
    });

    it('omits title when it is not a string (defends against array coercion)', () => {
      // expo-linking can return string[] for ?title=a&title=b
      const result = parseWebViewDeepLink({
        url: encodeURIComponent('https://onekey.so'),
        title: ['a', 'b'] as unknown as string,
      });
      expect(result?.title).toBeUndefined();
    });

    it('always tags source as "deeplink"', () => {
      const result = parseWebViewDeepLink({
        url: encodeURIComponent('https://onekey.so'),
      });
      expect(result?.source).toBe('deeplink');
    });

    it('accepts uppercase HTTP/HTTPS schemes', () => {
      const httpsResult = parseWebViewDeepLink({
        url: encodeURIComponent('HTTPS://Onekey.SO'),
      });
      expect(httpsResult?.url).toBe('HTTPS://Onekey.SO');
      const httpResult = parseWebViewDeepLink({
        url: encodeURIComponent('HTTP://example.com'),
      });
      expect(httpResult?.url).toBe('HTTP://example.com');
    });
  });

  describe('rejection', () => {
    it('rejects javascript: scheme', () => {
      expect(
        parseWebViewDeepLink({ url: encodeURIComponent(JS_SCHEME) }),
      ).toBeNull();
    });

    it('rejects file: scheme', () => {
      expect(
        parseWebViewDeepLink({ url: encodeURIComponent('file:///etc/passwd') }),
      ).toBeNull();
    });

    it('rejects data: scheme', () => {
      expect(
        parseWebViewDeepLink({
          url: encodeURIComponent('data:text/html,<script>alert(1)</script>'),
        }),
      ).toBeNull();
    });

    it('rejects about: scheme', () => {
      expect(
        parseWebViewDeepLink({ url: encodeURIComponent('about:blank') }),
      ).toBeNull();
    });

    it('rejects intent: scheme', () => {
      expect(
        parseWebViewDeepLink({
          url: encodeURIComponent('intent://example.com#Intent;end'),
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
          url: encodeURIComponent(`https://example.com/${longTail}`),
        }),
      ).toBeNull();
    });

    it('accepts URL exactly at the 2048-character boundary', () => {
      // 'https://x/' is 10 chars; pad path so total decoded length is 2048
      const padding = 'a'.repeat(2048 - 10);
      const url = `https://x/${padding}`;
      expect(url.length).toBe(2048);
      const result = parseWebViewDeepLink({ url: encodeURIComponent(url) });
      expect(result?.url).toBe(url);
    });

    it('rejects malformed percent-encoding (decodeURIComponent throws)', () => {
      // '%E0%A4%A' is incomplete UTF-8 sequence
      expect(parseWebViewDeepLink({ url: '%E0%A4%A' })).toBeNull();
    });

    it('does NOT bypass scheme check via percent-encoded scheme', () => {
      // %6A decodes to 'j', so the encoded form smuggles a `javascript:` URL
      // past a regex that runs on the encoded string. We decode FIRST, then
      // run the regex, so this must still be rejected.
      // oxlint-disable-next-line @cspell/spellchecker
      const sneaky = '%6A'.concat('avascript:alert(1)');
      expect(parseWebViewDeepLink({ url: sneaky })).toBeNull();
    });
  });
});
