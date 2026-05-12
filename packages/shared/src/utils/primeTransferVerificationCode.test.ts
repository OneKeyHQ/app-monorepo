import { buildPrimeTransferVerificationCode } from './primeTransferVerificationCode';

describe('buildPrimeTransferVerificationCode', () => {
  test('builds the verification code from two six-digit numbers', () => {
    expect(
      buildPrimeTransferVerificationCode({
        userPart: '338713',
        randomNumber: '576123',
      }),
    ).toEqual({
      ok: true,
      code: '804836',
    });
  });

  test('rejects user parts with non-digit characters', () => {
    expect(
      buildPrimeTransferVerificationCode({
        userPart: '12A456',
        randomNumber: '576123',
      }),
    ).toEqual({
      ok: false,
      reason: 'invalid-user-part',
    });
  });

  test('rejects random numbers with non-digit characters', () => {
    expect(
      buildPrimeTransferVerificationCode({
        userPart: '338713',
        randomNumber: '57B123',
      }),
    ).toEqual({
      ok: false,
      reason: 'invalid-random-number',
    });
  });

  test('rejects repeated-digit verification codes', () => {
    expect(
      buildPrimeTransferVerificationCode({
        userPart: '111111',
        randomNumber: '000000',
      }),
    ).toEqual({
      ok: false,
      reason: 'repeated-digits',
    });
  });
});
