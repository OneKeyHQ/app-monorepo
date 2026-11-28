import { stripDiagnosticRequestUrl } from './errorToastUtils';

describe('stripDiagnosticRequestUrl', () => {
  it('drops the query and hash and keeps the path', () => {
    expect(
      stripDiagnosticRequestUrl(
        'https://api.onekey.so/wallet/v1/account/token/list?token=secret#frag',
      ),
    ).toBe('https://api.onekey.so/wallet/v1/account/token/list');
  });

  it('leaves a url that already has no query', () => {
    expect(stripDiagnosticRequestUrl('https://api.onekey.so/wallet/v1')).toBe(
      'https://api.onekey.so/wallet/v1',
    );
  });

  it('strips a value that is not a full url', () => {
    expect(stripDiagnosticRequestUrl('/wallet/v1?token=secret#frag')).toBe(
      '/wallet/v1',
    );
  });
});
