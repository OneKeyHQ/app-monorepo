import {
  getSafeUnifoldRecipient,
  isUnifoldDepositAccountDisabled,
  isUnifoldRecipientAligned,
} from './unifoldRecipient';

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

describe('isUnifoldDepositAccountDisabled', () => {
  it('disables deposits for watch-only accounts', () => {
    expect(
      isUnifoldDepositAccountDisabled(
        'watching--60--0x1111111111111111111111111111111111111111',
      ),
    ).toBe(true);
  });

  it('keeps deposits enabled for signable and missing account ids', () => {
    expect(isUnifoldDepositAccountDisabled('hd-1--m/44/60/0/0/0')).toBe(false);
    expect(isUnifoldDepositAccountDisabled(undefined)).toBe(false);
  });
});

describe('isUnifoldRecipientAligned', () => {
  it('requires a non-empty live account matching the frozen recipient', () => {
    expect(
      isUnifoldRecipientAligned({
        recipient: ADDR,
        activeAccountAddress: ADDR,
      }),
    ).toBe(true);
    expect(
      isUnifoldRecipientAligned({
        recipient: ADDR,
        activeAccountAddress: ADDR.toUpperCase(),
      }),
    ).toBe(true);
    expect(
      isUnifoldRecipientAligned({
        recipient: ADDR,
        activeAccountAddress: null,
      }),
    ).toBe(false);
    expect(
      isUnifoldRecipientAligned({
        recipient: ADDR,
        activeAccountAddress: '0x2222222222222222222222222222222222222222',
      }),
    ).toBe(false);
  });
});
