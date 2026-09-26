import { redactErrorMessageForLocalLog } from './redactErrorMessage';

describe('redactErrorMessageForLocalLog', () => {
  it('redacts account ids, wallet ids, and standalone addresses', () => {
    const message =
      'record not found: Account watching--60--0xf5881234567890abcdef1234567890abcdef1234 wallet hd-1 address 0x1234567890abcdef1234567890abcdef12345678';

    const result = redactErrorMessageForLocalLog(message);

    expect(result).toContain('[account-id]');
    expect(result).toContain('[wallet-id]');
    expect(result).toContain('[address]');
    expect(result).not.toContain('0xf5881234');
    expect(result).not.toContain('hd-1');
  });

  it('keeps diagnostic prose while applying existing credential scrubbing', () => {
    expect(
      redactErrorMessageForLocalLog(
        'request failed: token=secret-value for network evm--1',
      ),
    ).toBe('request failed: token=[redacted] for network [account-id]');
  });

  it('preserves an absent message', () => {
    expect(redactErrorMessageForLocalLog(undefined)).toBeUndefined();
  });
});
