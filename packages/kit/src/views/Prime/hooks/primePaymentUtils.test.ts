import primePaymentUtils from './primePaymentUtils';

/*
yarn test packages/kit/src/views/Prime/hooks/primePaymentUtils.test.ts
*/

describe('primePaymentUtils', () => {
  describe('extractCurrencySymbol', () => {
    it('should extract $ from $183.77', () => {
      expect(primePaymentUtils.extractCurrencySymbol('$183.77')).toBe('$');
    });

    it('should extract US$ from US$328.44', () => {
      expect(primePaymentUtils.extractCurrencySymbol('US$328.44')).toBe('US$');
    });

    it('should extract € from €99.99', () => {
      expect(primePaymentUtils.extractCurrencySymbol('€99.99')).toBe('€');
    });

    it('should extract ¥ from ¥100', () => {
      expect(primePaymentUtils.extractCurrencySymbol('¥100')).toBe('¥');
    });

    it('should extract £ from £50', () => {
      expect(primePaymentUtils.extractCurrencySymbol('£50')).toBe('£');
    });

    it('should extract CA$ from CA$75.50', () => {
      expect(primePaymentUtils.extractCurrencySymbol('CA$75.50')).toBe('CA$');
    });

    it('should extract RMB¥ from RMB¥100', () => {
      expect(primePaymentUtils.extractCurrencySymbol('RMB¥100')).toBe('RMB¥');
    });

    it('should extract $ from -$50', () => {
      expect(primePaymentUtils.extractCurrencySymbol('-$50')).toBe('$');
    });

    it('should extract US$ from US$-100', () => {
      expect(primePaymentUtils.extractCurrencySymbol('US$-100')).toBe('US$');
    });

    it('should extract $ from -$50.99', () => {
      expect(primePaymentUtils.extractCurrencySymbol('-$50.99')).toBe('$');
    });

    it('should extract US$ from US$-100.50', () => {
      expect(primePaymentUtils.extractCurrencySymbol('US$-100.50')).toBe('US$');
    });

    it('should extract € from -€75.25', () => {
      expect(primePaymentUtils.extractCurrencySymbol('-€75.25')).toBe('€');
    });

    it('should extract ¥ from CNY¥-88.88', () => {
      expect(primePaymentUtils.extractCurrencySymbol('-¥88.88')).toBe('¥');
    });
  });
});
