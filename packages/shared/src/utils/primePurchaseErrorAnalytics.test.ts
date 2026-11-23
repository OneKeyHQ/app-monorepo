import { getPrimePurchaseErrorAnalytics } from './primePurchaseErrorAnalytics';

describe('getPrimePurchaseErrorAnalytics', () => {
  it.each([
    {
      name: 'Android userInfo',
      error: {
        code: '23',
        userInfo: {
          underlyingErrorMessage: 'Network request failed for user@example.com',
        },
      },
    },
    {
      name: 'iOS underlying NSError',
      error: {
        code: '23',
        userInfo: {
          NSUnderlyingError: {
            code: '2',
            domain: 'SKErrorDomain',
            message: 'underlying error',
            userInfo: {
              NSUnderlyingError: {
                code: '-1009',
                domain: 'NSURLErrorDomain',
                message: 'underlying error',
                userInfo: { NSLocalizedDescription: '互联网连接已断开' },
              },
            },
          },
        },
      },
    },
  ])(
    'reads a network cause from $name without exporting raw details',
    ({ error }) => {
      const result = getPrimePurchaseErrorAnalytics(error);

      expect(result).toEqual({
        errorCode: '23',
        errorName: 'CONFIGURATION_ERROR',
        underlyingErrorCategory: 'network',
      });
      expect(JSON.stringify(result)).not.toContain('user@example.com');
      expect(result).not.toHaveProperty('userInfo');
    },
  );

  it('distinguishes missing store products from other configuration errors', () => {
    expect(
      getPrimePurchaseErrorAnalytics({
        code: '23',
        message:
          'None of the products registered in the RevenueCat dashboard could be fetched from App Store Connect.',
      }).underlyingErrorCategory,
    ).toBe('productUnavailable');
    expect(
      getPrimePurchaseErrorAnalytics({
        code: '23',
        message: 'There are no products configured for the selected API key.',
      }).underlyingErrorCategory,
    ).toBe('storeConfig');
  });

  it('bounds traversal of a malformed underlying error chain', () => {
    const userInfo: { NSUnderlyingError?: unknown } = {};
    const error = { code: '23', userInfo };
    userInfo.NSUnderlyingError = error;

    expect(getPrimePurchaseErrorAnalytics(error).underlyingErrorCategory).toBe(
      'storeConfig',
    );
  });

  it('maps known RevenueCat codes and never returns raw error details', () => {
    const secret = 'user@example.com';
    const result = getPrimePurchaseErrorAnalytics({
      code: 20,
      message: `payment pending for ${secret}`,
      underlyingErrorMessage: `request failed for ${secret}`,
    });

    expect(result).toEqual({
      errorCode: '20',
      errorName: 'PAYMENT_PENDING_ERROR',
      underlyingErrorCategory: 'unknown',
    });
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(result).not.toHaveProperty('message');
    expect(result).not.toHaveProperty('underlyingErrorMessage');
  });
});
