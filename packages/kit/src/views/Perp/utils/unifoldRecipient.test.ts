import { getSafeUnifoldRecipient } from './unifoldRecipient';

const ADDR = '0x1111111111111111111111111111111111111111';

describe('getSafeUnifoldRecipient', () => {
  it('returns address when it matches active account', () => {
    expect(
      getSafeUnifoldRecipient({ recipient: ADDR, activeAccountAddress: ADDR }),
    ).toBe(ADDR);
  });

  it('returns null for empty recipient or missing active account', () => {
    expect(
      getSafeUnifoldRecipient({ recipient: '', activeAccountAddress: ADDR }),
    ).toBeNull();
    expect(
      getSafeUnifoldRecipient({
        recipient: ADDR,
        activeAccountAddress: undefined,
      }),
    ).toBeNull();
    expect(
      getSafeUnifoldRecipient({ recipient: null, activeAccountAddress: ADDR }),
    ).toBeNull();
    expect(
      getSafeUnifoldRecipient({ recipient: ADDR, activeAccountAddress: null }),
    ).toBeNull();
  });

  it('returns null for a malformed address', () => {
    expect(
      getSafeUnifoldRecipient({
        recipient: '0x123',
        activeAccountAddress: '0x123',
      }),
    ).toBeNull();
  });

  it('returns null when recipient differs from active account', () => {
    expect(
      getSafeUnifoldRecipient({
        recipient: ADDR,
        activeAccountAddress: '0x2222222222222222222222222222222222222222',
      }),
    ).toBeNull();
  });

  it('matches case-insensitively', () => {
    const mixedCase = '0xABCDEF1111111111111111111111111111111111';
    expect(
      getSafeUnifoldRecipient({
        recipient: mixedCase,
        activeAccountAddress: mixedCase.toLowerCase(),
      }),
    ).toBe(mixedCase);
  });
});
