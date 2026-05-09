import { isAllowedWebViewUrl } from '../urlSafety';

// Avoid the literal `javascript:` URL form to satisfy `no-script-url`.
const JS_SCHEME_URL = ['java', 'script:', 'alert(1)'].join('');

describe('isAllowedWebViewUrl', () => {
  describe('accepts', () => {
    it.each([
      ['https://onekey.so'],
      ['https://onekey.so/'],
      ['HTTPS://Onekey.SO'],
      ['https://onekey.so/promo?utm_source=campaign'],
      ['https://example.com:8443/path'],
      ['https://sub.domain.example.com/'],
      ['https://example.com/#fragment'],
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
      ['https://[fc00::1]/'], // unique-local
      ['https://[fd00::1]/'], // unique-local
      ['https://[ff02::1]/'], // multicast
      ['https://[::ffff:127.0.0.1]/'], // IPv4-mapped loopback
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
      expect(isAllowedWebViewUrl(`https://example.com/${longTail}`)).toBe(false);
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
