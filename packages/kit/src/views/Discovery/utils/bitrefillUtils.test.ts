import {
  BITREFILL_EMBED_ORIGIN,
  BITREFILL_REF_CODE,
  getBitrefillEmbedUrl,
} from './bitrefillUtils';

describe('bitrefillUtils', () => {
  describe('constants', () => {
    it('exposes embed origin as https://embed.bitrefill.com', () => {
      expect(BITREFILL_EMBED_ORIGIN).toBe('https://embed.bitrefill.com');
    });

    it('exposes referral code bronekey01', () => {
      expect(BITREFILL_REF_CODE).toBe('bronekey01');
    });
  });

  describe('getBitrefillEmbedUrl', () => {
    const url = getBitrefillEmbedUrl();
    const parsed = new URL(url);

    it('uses embed origin as base', () => {
      expect(parsed.origin).toBe(BITREFILL_EMBED_ORIGIN);
    });

    it('includes ref=bronekey01', () => {
      expect(parsed.searchParams.get('ref')).toBe('bronekey01');
    });

    it('includes utm_source=onekey', () => {
      expect(parsed.searchParams.get('utm_source')).toBe('onekey');
    });

    it('includes EVM-only paymentMethods', () => {
      const methods =
        parsed.searchParams.get('paymentMethods')?.split(',') ?? [];
      expect(methods).toEqual(
        expect.arrayContaining([
          'ethereum',
          'eth_base',
          'usdc_erc20',
          'usdc_polygon',
          'usdc_arbitrum',
          'usdc_base',
          'usdt_erc20',
          'usdt_polygon',
          'usdt_arbitrum',
          'usdt_bsc',
        ]),
      );
    });

    it('does not include non-EVM payment methods', () => {
      const methods =
        parsed.searchParams.get('paymentMethods')?.split(',') ?? [];
      expect(methods).not.toContain('bitcoin');
      expect(methods).not.toContain('lightning');
      expect(methods).not.toContain('usdt_trc20');
      expect(methods).not.toContain('usdc_solana');
    });
  });
});
