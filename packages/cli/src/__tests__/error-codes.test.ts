import { EXIT_CODES, getExitCode, ERROR_CODES } from '../errors/error-codes';

describe('error-codes', () => {
  it('maps PARAM_ prefix to exit code 2', () => {
    expect(getExitCode('PARAM_INVALID_ADDRESS')).toBe(EXIT_CODES.PARAM);
  });

  it('maps BIZ_ prefix to exit code 1', () => {
    expect(getExitCode('BIZ_UNKNOWN')).toBe(EXIT_CODES.BIZ);
  });

  it('maps NET_ prefix to exit code 3', () => {
    expect(getExitCode('NET_RPC_TIMEOUT')).toBe(EXIT_CODES.NET);
  });

  it('maps AUTH_ prefix to exit code 4', () => {
    expect(getExitCode('AUTH_NO_WALLET')).toBe(EXIT_CODES.AUTH);
  });

  it('maps SEC_ prefix to exit code 5', () => {
    expect(getExitCode('SEC_KEYCHAIN_LOCKED')).toBe(EXIT_CODES.SEC);
  });

  it('defaults unknown prefix to BIZ exit code', () => {
    expect(getExitCode('UNKNOWN_ERROR')).toBe(EXIT_CODES.BIZ);
  });

  it('all ERROR_CODES have valid code strings', () => {
    for (const entry of Object.values(ERROR_CODES)) {
      expect(typeof entry.code).toBe('string');
      expect(entry.code.length).toBeGreaterThan(0);
      expect(typeof entry.exitCode).toBe('number');
    }
  });
});
