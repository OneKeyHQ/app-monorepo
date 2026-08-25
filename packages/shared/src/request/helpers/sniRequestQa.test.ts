import { getSniRequestErrorCode } from './sniRequestQaUtils';

describe('getSniRequestErrorCode', () => {
  test('reads a structured error code', () => {
    expect(
      getSniRequestErrorCode(
        Object.assign(new Error('Request cancelled'), {
          code: 'SNI_CANCELLED',
        }),
      ),
    ).toBe('SNI_CANCELLED');
  });

  test('recovers an SNI code from an Electron IPC-safe message', () => {
    expect(
      getSniRequestErrorCode(
        new Error(
          "Error invoking remote method 'DESKTOP_API_CALL': SNI_CANCELLED: Request cancelled",
        ),
      ),
    ).toBe('SNI_CANCELLED');
  });
});
