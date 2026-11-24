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
    expect(
      getSniRequestErrorCode(
        new Error(
          "Error invoking remote method 'DESKTOP_API_CALL': Error: connect ECONNREFUSED 93.184.216.34:443",
        ),
      ),
    ).toBe('SNI_CONNECTION_REFUSED');
    expect(
      getSniRequestErrorCode(
        new Error('getaddrinfo ENOTFOUND wallet.onekeycn.com'),
      ),
    ).toBe('SNI_DNS_FAILED');
  });
});
