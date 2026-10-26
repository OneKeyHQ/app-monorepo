import {
  isWcPayEmbedUrl,
  stripFrameBlockingHeaders,
} from './wcPayFrameEmbedding';

// Real-world CSP captured from https://pay.walletconnect.com/collect
const WC_PAY_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline' https://eu.i.posthog.com; style-src 'self' 'unsafe-inline'; connect-src 'self' https://api.pay.walletconnect.org wss://relay.walletconnect.org; img-src 'self' data: https:; frame-src 'self' https://verify.walletconnect.com; frame-ancestors https:";

const WC_PAY_CSP_WITHOUT_FRAME_ANCESTORS =
  "default-src 'self'; script-src 'self' 'unsafe-inline' https://eu.i.posthog.com; style-src 'self' 'unsafe-inline'; connect-src 'self' https://api.pay.walletconnect.org wss://relay.walletconnect.org; img-src 'self' data: https:; frame-src 'self' https://verify.walletconnect.com";

describe('isWcPayEmbedUrl', () => {
  it('accepts the trusted pay host and its subdomains over https', () => {
    expect(isWcPayEmbedUrl('https://pay.walletconnect.com/collect?pid=x')).toBe(
      true,
    );
    expect(isWcPayEmbedUrl('https://forms.pay.walletconnect.com/x')).toBe(true);
  });

  it('rejects other hosts, lookalike hosts, and non-https schemes', () => {
    expect(isWcPayEmbedUrl('http://pay.walletconnect.com/collect')).toBe(false);
    expect(isWcPayEmbedUrl('https://walletconnect.com/')).toBe(false);
    expect(isWcPayEmbedUrl('https://pay.walletconnect.com.evil.com/')).toBe(
      false,
    );
    expect(isWcPayEmbedUrl('https://evilpay.walletconnect.com/')).toBe(false);
    expect(isWcPayEmbedUrl('not a url')).toBe(false);
  });
});

describe('stripFrameBlockingHeaders', () => {
  it('removes only the frame-ancestors directive and keeps the rest of the CSP', () => {
    const result = stripFrameBlockingHeaders({
      'content-security-policy': [WC_PAY_CSP],
      'content-type': ['text/html'],
    });
    expect(result).toEqual({
      'content-security-policy': [WC_PAY_CSP_WITHOUT_FRAME_ANCESTORS],
      'content-type': ['text/html'],
    });
  });

  it('handles header name casing variants and multiple values', () => {
    const result = stripFrameBlockingHeaders({
      'Content-Security-Policy': [WC_PAY_CSP, 'frame-ancestors https:'],
    });
    expect(result).toEqual({
      'Content-Security-Policy': [WC_PAY_CSP_WITHOUT_FRAME_ANCESTORS],
    });
  });

  it('drops the CSP header entirely when frame-ancestors was its only directive', () => {
    const result = stripFrameBlockingHeaders({
      'content-security-policy': ["frame-ancestors 'none'"],
      'content-type': ['text/html'],
    });
    expect(result).toEqual({ 'content-type': ['text/html'] });
  });

  it('removes x-frame-options in any casing', () => {
    const result = stripFrameBlockingHeaders({
      'X-Frame-Options': ['DENY'],
      'content-type': ['text/html'],
    });
    expect(result).toEqual({ 'content-type': ['text/html'] });
  });

  it('leaves unrelated headers untouched and passes undefined through', () => {
    expect(
      stripFrameBlockingHeaders({ 'content-type': ['text/html'] }),
    ).toEqual({ 'content-type': ['text/html'] });
    expect(stripFrameBlockingHeaders(undefined)).toBeUndefined();
  });
});
