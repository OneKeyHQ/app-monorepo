import primePaymentUtils from './primePaymentUtils';

/*
yarn test packages/kit/src/views/Prime/hooks/primePaymentUtils.test.ts
*/

describe('primePaymentUtils', () => {
  describe('normalizeNativePrice', () => {
    it('keeps current RevenueCat prices in major currency units', () => {
      expect(primePaymentUtils.normalizeNativePrice(29.99, 'major')).toBe(
        29.99,
      );
    });

    it('converts legacy Android RevenueCat prices from micros', () => {
      expect(primePaymentUtils.normalizeNativePrice(29_990_000, 'micros')).toBe(
        29.99,
      );
    });
  });

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

  describe('classifyPurchaseError', () => {
    it('classifies react-native-purchases cancellation via userCancelled flag', () => {
      expect(
        primePaymentUtils.classifyPurchaseError({
          userCancelled: true,
          code: 1,
          message: 'Purchase was cancelled.',
        }),
      ).toEqual({
        reason: 'userCancelled',
        errorCode: '1',
        errorMessage: 'Purchase was cancelled.',
      });
    });

    it('classifies native cancellation via readable message when the flag is missing', () => {
      expect(
        primePaymentUtils.classifyPurchaseError(
          new Error('Purchase was cancelled.'),
        ),
      ).toEqual({
        reason: 'userCancelled',
        errorCode: undefined,
        errorMessage: 'Purchase was cancelled.',
      });
    });

    it('classifies purchases-js cancellation via errorCode', () => {
      expect(
        primePaymentUtils.classifyPurchaseError({
          errorCode: 1,
          message: 'User cancelled',
        }),
      ).toEqual({
        reason: 'userCancelled',
        errorCode: '1',
        errorMessage: 'User cancelled',
      });
    });

    it('classifies other errors as paymentFailed with a stringified code', () => {
      expect(
        primePaymentUtils.classifyPurchaseError({
          code: 2,
          userCancelled: false,
          message: 'Store connection failed',
        }),
      ).toEqual({
        reason: 'paymentFailed',
        errorCode: '2',
        errorMessage: 'Store connection failed',
      });
    });

    it('handles non-object errors safely', () => {
      expect(primePaymentUtils.classifyPurchaseError(undefined)).toEqual({
        reason: 'paymentFailed',
        errorCode: undefined,
        errorMessage: undefined,
      });
    });
  });
});
