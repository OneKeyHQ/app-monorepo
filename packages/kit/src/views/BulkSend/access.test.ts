import { canAccessBulkSend } from './access';

describe('BulkSend access', () => {
  it('allows E2E without a Prime subscription', () => {
    expect(
      canAccessBulkSend({
        isE2E: true,
        isPrimeActive: false,
      }),
    ).toBe(true);
  });

  it('requires an active Prime user outside E2E', () => {
    expect(
      canAccessBulkSend({
        isE2E: false,
        isPrimeActive: true,
        oneKeyUserId: 'prime-user',
      }),
    ).toBe(true);
    expect(
      canAccessBulkSend({
        isE2E: false,
        isPrimeActive: false,
        oneKeyUserId: 'prime-user',
      }),
    ).toBe(false);
    expect(
      canAccessBulkSend({
        isE2E: false,
        isPrimeActive: true,
      }),
    ).toBe(false);
  });
});
