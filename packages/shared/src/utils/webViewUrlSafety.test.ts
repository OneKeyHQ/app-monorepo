import { isAllowedWebViewUrl } from './webViewUrlSafety';

// Avoid the literal `javascript:` URL form to satisfy `no-script-url`.
const JS_SCHEME_URL = ['java', 'script:', 'alert(1)'].join('');

describe('isAllowedWebViewUrl', () => {
  describe('accepts', () => {
    it.each([
      ['https://onekey.so'],
      ['https://onekey.so/'],
      ['HTTPS://Onekey.SO'],
      ['https://onekey.so/promo?utm_source=campaign'],
      ['https://example.com:443/explicit-default-port'],
      ['https://sub.domain.example.com/'],
      ['https://example.com/#fragment'],
      ['https://example.com/file.exe.html'], // extension not at end
      ['https://example.com/installer/notes.html'],
      ['https://example.com/article.pdf'], // documents render inline
      ['https://example.com/video.mp4'], // media renders inline
    ])('%s', (url) => {
      expect(isAllowedWebViewUrl(url)).toBe(true);
    });
  });

  describe('rejects scheme', () => {
    it.each([
      ['http://example.com', 'http'],
      ['HTTP://example.com', 'uppercase HTTP'],
      [JS_SCHEME_URL, 'javascript'],
      ['file:///etc/passwd', 'file'],
      ['ftp://example.com', 'ftp'],
      ['data:text/html,<x>', 'data'],
      ['blob:https://example.com/abc', 'blob'],
      ['about:blank', 'about'],
      ['intent://example.com#Intent;end', 'intent'],
      ['ws://example.com', 'ws'],
      ['ssh://example.com', 'ssh'],
      ['onekey-wallet://main', 'custom scheme'],
    ])('%s (%s)', (url) => {
      expect(isAllowedWebViewUrl(url)).toBe(false);
    });
  });

  describe('rejects userinfo', () => {
    it.each([
      ['https://trusted.com@evil.com/'],
      ['https://user:pass@example.com'],
      ['https://:password@example.com'],
      ['https://%65vil.com@trusted.com/'],
    ])('%s', (url) => {
      expect(isAllowedWebViewUrl(url)).toBe(false);
    });
  });

  describe('rejects localhost / loopback hostnames', () => {
    it.each([
      ['https://localhost'],
      ['https://localhost:3000'],
      ['https://LocalHost/admin'],
      ['https://api.localhost/'],
      ['https://broadcasthost/'],
      ['https://ip6-localhost/'],
      ['https://ip6-loopback/'],
      // FQDN form (trailing dot) — resolvers treat it as the same address but
      // a naive equality / suffix check would miss it.
      ['https://localhost./'],
      ['https://localhost.../'],
      ['https://api.localhost./'],
      ['https://LocalHost./admin'],
    ])('%s', (url) => {
      expect(isAllowedWebViewUrl(url)).toBe(false);
    });
  });

  describe('rejects IPv4 private / loopback / reserved ranges', () => {
    it.each([
      ['https://0.0.0.0/'],
      ['https://0.1.2.3/'],
      ['https://127.0.0.1/'],
      ['https://127.0.0.1:8080/admin'],
      ['https://127.255.255.254/'],
      ['https://10.0.0.1/'],
      ['https://10.255.255.255/'],
      ['https://172.16.0.1/'],
      ['https://172.20.5.10/'],
      ['https://172.31.255.254/'],
      ['https://192.168.0.1/'],
      ['https://192.168.1.100/'],
      ['https://169.254.169.254/latest/meta-data/'], // AWS metadata!
      ['https://224.0.0.1/'], // multicast
      ['https://239.255.255.255/'], // multicast
      ['https://240.0.0.1/'], // reserved
      ['https://255.255.255.255/'], // limited broadcast
    ])('%s', (url) => {
      expect(isAllowedWebViewUrl(url)).toBe(false);
    });
  });

  describe('accepts IPv4 in public ranges', () => {
    it.each([
      ['https://1.1.1.1/'],
      ['https://8.8.8.8/'],
      ['https://172.15.0.1/'], // just outside 172.16/12
      ['https://172.32.0.1/'], // just outside 172.16/12 high end
      ['https://192.167.0.1/'], // just outside 192.168/16
      ['https://192.169.0.1/'], // just outside 192.168/16
    ])('%s', (url) => {
      expect(isAllowedWebViewUrl(url)).toBe(true);
    });
  });

  describe('rejects IPv6 loopback / link-local / unique-local / multicast', () => {
    it.each([
      ['https://[::1]/'],
      ['https://[::]/'],
      ['https://[fe80::1]/'],
      ['https://[fe80::1234:5678]/'],
      // upper half of fe80::/10 — also link-local per RFC 4291
      ['https://[fe90::1]/'],
      ['https://[fea0::1]/'],
      ['https://[feb0::1]/'],
      ['https://[febf::1]/'],
      ['https://[fc00::1]/'], // unique-local low boundary
      ['https://[fd00::1]/'], // unique-local mid
      ['https://[fdff::1]/'], // unique-local upper boundary
      ['https://[ff00::1]/'], // multicast lower boundary
      ['https://[ff02::1]/'], // link-local all-nodes multicast
      ['https://[ffff::1]/'], // multicast upper boundary
      ['https://[::ffff:127.0.0.1]/'], // IPv4-mapped loopback
    ])('%s', (url) => {
      expect(isAllowedWebViewUrl(url)).toBe(false);
    });
  });

  describe('IPv6 boundary precision (bitmask, not string prefix)', () => {
    // 16-bit groups that LOOK similar to reserved ranges but are actually
    // global unicast — string-prefix checks (`startsWith('fc')` /
    // `startsWith('ff')`) would over-reject these. The bitmask implementation
    // correctly accepts them because the address bits don't fall into the
    // reserved range.
    //   `[fc::1]` parses to `00fc::1` (NOT in fc00::/7)
    //   `[ff::1]` parses to `00ff::1` (NOT in ff00::/8)
    //   `[fe::1]` parses to `00fe::1` (NOT in fe80::/10)
    // We don't actively want users hitting these obscure addresses, but
    // accepting them keeps the local-address rejection aligned with RFC
    // 4193/4291 rather than acting on a typo-tolerant string match.
    it.each([
      ['https://[fc::1]/'], // 00fc::, global unicast
      ['https://[fd::1]/'], // 00fd::, global unicast
      ['https://[fe::1]/'], // 00fe::, global unicast
      ['https://[ff::1]/'], // 00ff::, global unicast
    ])('accepts %s (not in reserved range)', (url) => {
      expect(isAllowedWebViewUrl(url)).toBe(true);
    });
  });

  describe('rejects custom ports (only 443 allowed)', () => {
    it.each([
      ['https://example.com:80/'],
      ['https://example.com:8080/'],
      ['https://example.com:8443/'],
      ['https://example.com:9000/'],
      ['https://example.com:1/'],
      ['https://example.com:65535/'],
    ])('%s', (url) => {
      expect(isAllowedWebViewUrl(url)).toBe(false);
    });
  });

  describe('rejects punycode / IDN homograph hostnames', () => {
    it.each([
      // Raw punycode (xn--…) — exact form an attacker would put on the wire.
      ['https://xn--s7y.co/'], // 短 a-with-acute
      ['https://xn--fiq228c.com/'], // generic punycode
      // Unicode/IDN homographs that V8 normalizes to xn-- and Hermes keeps as
      // Unicode; either way `containsPunycode` flags both directions.
      ['https://аррӏе.com/'], // Cyrillic look-alike of "apple.com"
      ['https://新华网.cn/'], // Han script
      ['https://例え.テスト/'], // mixed Han + Kana
    ])('%s', (url) => {
      expect(isAllowedWebViewUrl(url)).toBe(false);
    });
  });

  describe('rejects direct-download URLs', () => {
    it.each([
      ['https://example.com/installer.zip'],
      ['https://example.com/path/to/payload.zip'],
      ['https://example.com/download/file.zip?token=abc'],
      ['https://example.com/Setup.exe'],
      ['https://example.com/SETUP.EXE'], // case-insensitive
      ['https://example.com/installer.msi'],
      ['https://example.com/app.dmg'],
      ['https://example.com/app.pkg'],
      ['https://example.com/release.apk'],
      ['https://example.com/release.ipa'],
      ['https://example.com/package.deb'],
      ['https://example.com/package.rpm'],
      ['https://example.com/disk.iso'],
      ['https://example.com/firmware.img'],
      ['https://example.com/firmware.bin'],
      ['https://example.com/archive.7z'],
      ['https://example.com/archive.rar'],
      ['https://example.com/archive.tar'],
      ['https://example.com/archive.tar.gz'],
      ['https://example.com/archive.tgz'],
      ['https://example.com/archive.gz'],
      ['https://example.com/archive.bz2'],
      // Percent-encoded variants must not bypass the suffix match — URL.pathname
      // keeps `%2E` etc. verbatim, so isLikelyDownloadPath has to decode first.
      ['https://example.com/installer%2Eexe'],
      ['https://example.com/payload%2Ezip'],
      ['https://example.com/release%2Eapk?token=abc'],
      ['https://example.com/Setup%2EEXE'],
      ['https://example.com/path/to/file%2Eapk'],
      // Fail closed when the pathname has a malformed percent-escape
      // (decodeURIComponent throws): treat as suspicious instead of allowing.
      ['https://example.com/file%E0%A4.exe'],
      ['https://example.com/lone%'],
    ])('%s', (url) => {
      expect(isAllowedWebViewUrl(url)).toBe(false);
    });
  });

  describe('format/length', () => {
    it('rejects empty string', () => {
      expect(isAllowedWebViewUrl('')).toBe(false);
    });
    it('rejects undefined', () => {
      expect(isAllowedWebViewUrl(undefined)).toBe(false);
    });
    it('rejects null', () => {
      expect(isAllowedWebViewUrl(null)).toBe(false);
    });
    it('rejects non-string', () => {
      expect(isAllowedWebViewUrl(123 as unknown as string)).toBe(false);
    });
    it('rejects URL longer than 2048 characters', () => {
      const longTail = 'a'.repeat(2050);
      expect(isAllowedWebViewUrl(`https://example.com/${longTail}`)).toBe(
        false,
      );
    });
    it('accepts URL exactly at the 2048-character boundary', () => {
      const padding = 'a'.repeat(2048 - 'https://x/'.length);
      const url = `https://x/${padding}`;
      expect(url.length).toBe(2048);
      expect(isAllowedWebViewUrl(url)).toBe(true);
    });
    it('rejects malformed URL the parser cannot read', () => {
      expect(isAllowedWebViewUrl('https://')).toBe(false);
    });
  });
});
