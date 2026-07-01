import { redactIpLiterals, safeSniLogValue } from './sniLogRedaction';

describe('sniLogRedaction', () => {
  test('redacts IPv4 literals without removing ports', () => {
    expect(redactIpLiterals('connect ECONNREFUSED 1.2.3.4:443')).toBe(
      'connect ECONNREFUSED <ip>:443',
    );
    expect(redactIpLiterals('Forbidden IP: 10.0.0.5')).toBe(
      'Forbidden IP: <ip>',
    );
  });

  test('redacts IPv6 literals and embedded IPv4 forms', () => {
    expect(redactIpLiterals('ETIMEDOUT 2001:4860:4860::8888:443')).toBe(
      'ETIMEDOUT <ip6>',
    );
    expect(redactIpLiterals('Invalid IP: [2001:4860:4860::8888]')).toBe(
      'Invalid IP: <ip6>',
    );
    expect(redactIpLiterals('connect [2001:4860:4860::8888]:443')).toBe(
      'connect <ip6>:443',
    );
    expect(redactIpLiterals('Response stream error: 64:ff9b::10.0.0.1')).toBe(
      'Response stream error: <ip6>',
    );
  });

  test('keeps non-IP colon values and formats log fields', () => {
    expect(redactIpLiterals('timestamp 10:12:35')).toBe('timestamp 10:12:35');
    expect(safeSniLogValue('Forbidden IP: 10.0.0.5\nnext')).toBe(
      'Forbidden_IP:_<ip>_next',
    );
    expect(safeSniLogValue(null)).toBe('none');
  });
});
