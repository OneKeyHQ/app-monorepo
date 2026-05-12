import { buildTransferVerificationCode } from '../core/prime-transfer/verification-code';
import { AppError, ERROR_CODES } from '../errors';

describe('buildTransferVerificationCode', () => {
  it('builds a verification code for valid numeric inputs', () => {
    expect(
      buildTransferVerificationCode({
        userId: 'user--338713',
        randomNumber: '576123',
      }),
    ).toBe('804836');
  });

  it('fails closed when the user id suffix contains non-digit characters', () => {
    expect.assertions(2);

    try {
      buildTransferVerificationCode({
        userId: 'user--12A456',
        randomNumber: '576123',
      });
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect(error).toMatchObject({
        code: ERROR_CODES.NET_REQUEST_FAILED.code,
        message: 'App Transfer verification code is unavailable.',
      });
    }
  });
});
