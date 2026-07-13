import {
  isBitrefillOrigin,
  parseBitrefillPaymentIntent,
} from './bitrefillHandler';

describe('bitrefillHandler', () => {
  describe('isBitrefillOrigin', () => {
    it('accepts exact https://embed.bitrefill.com', () => {
      expect(isBitrefillOrigin('https://embed.bitrefill.com')).toBe(true);
    });

    it('rejects http scheme', () => {
      expect(isBitrefillOrigin('http://embed.bitrefill.com')).toBe(false);
    });

    it('rejects other bitrefill subdomains (exact match only)', () => {
      expect(isBitrefillOrigin('https://www.bitrefill.com')).toBe(false);
      expect(isBitrefillOrigin('https://api.bitrefill.com')).toBe(false);
    });

    it('rejects spoofed origins', () => {
      expect(isBitrefillOrigin('https://evil-bitrefill.com')).toBe(false);
      expect(isBitrefillOrigin('https://embed.bitrefill.com.evil.com')).toBe(
        false,
      );
    });

    it('rejects undefined and empty', () => {
      expect(isBitrefillOrigin(undefined)).toBe(false);
      expect(isBitrefillOrigin('')).toBe(false);
    });
  });

  describe('parseBitrefillPaymentIntent', () => {
    it('parses valid JSON string payload', () => {
      const raw = JSON.stringify({
        event: 'payment_intent',
        paymentUri: 'ethereum:0x123@1?value=1e17',
      });
      expect(parseBitrefillPaymentIntent(raw)).toEqual({
        event: 'payment_intent',
        paymentUri: 'ethereum:0x123@1?value=1e17',
      });
    });

    it('parses valid object payload', () => {
      const raw = {
        event: 'payment_intent',
        paymentUri: 'ethereum:0xabc@137?value=1e6',
      };
      expect(parseBitrefillPaymentIntent(raw)).toEqual({
        event: 'payment_intent',
        paymentUri: 'ethereum:0xabc@137?value=1e6',
      });
    });

    it('returns null for invoice_created event (ignored)', () => {
      const raw = {
        event: 'invoice_created',
        invoiceId: 'x',
        paymentUri: 'ethereum:0x123@1?value=1e17',
      };
      expect(parseBitrefillPaymentIntent(raw)).toBeNull();
    });

    it('returns null when paymentUri is missing', () => {
      expect(
        parseBitrefillPaymentIntent({ event: 'payment_intent' }),
      ).toBeNull();
    });

    it('returns null when paymentUri is empty string', () => {
      expect(
        parseBitrefillPaymentIntent({
          event: 'payment_intent',
          paymentUri: '',
        }),
      ).toBeNull();
    });

    it('returns null when paymentUri is not a string', () => {
      expect(
        parseBitrefillPaymentIntent({
          event: 'payment_intent',
          paymentUri: 123,
        }),
      ).toBeNull();
    });

    it('returns null for malformed JSON string', () => {
      expect(parseBitrefillPaymentIntent('{not json')).toBeNull();
    });

    it('returns null for null and undefined input', () => {
      expect(parseBitrefillPaymentIntent(null)).toBeNull();
      expect(parseBitrefillPaymentIntent(undefined)).toBeNull();
    });
  });
});
