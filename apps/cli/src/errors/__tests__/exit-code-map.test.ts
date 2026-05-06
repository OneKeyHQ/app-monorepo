import { LockError, ServiceError, VaultError } from '../classes';
import { CLI_ERROR_CODES } from '../codes';
import { mapToExitCode } from '../exit-code-map';

const USER_ERROR_CODES = [
  CLI_ERROR_CODES.NOT_AUTHENTICATED,
  CLI_ERROR_CODES.VAULT_MISSING,
  CLI_ERROR_CODES.SESSION_EXPIRED,
  CLI_ERROR_CODES.SERVICE_KEY_NOT_FOUND,
  CLI_ERROR_CODES.INVALID_PAYLOAD,
  CLI_ERROR_CODES.INVALID_TX,
  CLI_ERROR_CODES.ADDRESS_NOT_DERIVED,
  CLI_ERROR_CODES.UNKNOWN_COMMAND,
] as const;

const SYSTEM_ERROR_CODES = [
  CLI_ERROR_CODES.VAULT_CORRUPT,
  CLI_ERROR_CODES.SERVICE_UNREACHABLE,
  CLI_ERROR_CODES.LOCK_TIMEOUT,
  CLI_ERROR_CODES.CLOCK_BACK_DETECTED,
  CLI_ERROR_CODES.VAULT_WRITE_FAILED,
  CLI_ERROR_CODES.UNKNOWN_ERROR,
] as const;

describe('CLI error code map', () => {
  it('maps user errors to exit 1', () => {
    for (const code of USER_ERROR_CODES) {
      expect(mapToExitCode(code)).toBe(1);
    }
  });

  it('maps system errors to exit 2', () => {
    for (const code of SYSTEM_ERROR_CODES) {
      expect(mapToExitCode(code)).toBe(2);
    }
  });

  it('covers every CLI error code exactly once', () => {
    const covered = new Set([...USER_ERROR_CODES, ...SYSTEM_ERROR_CODES]);
    expect(covered).toEqual(new Set(Object.values(CLI_ERROR_CODES)));
  });

  it('exposes typed error classes with causes', () => {
    const cause = new Error('root');

    expect(
      new VaultError(CLI_ERROR_CODES.VAULT_CORRUPT, { cause }),
    ).toMatchObject({
      code: CLI_ERROR_CODES.VAULT_CORRUPT,
      cause,
    });
    expect(new ServiceError(CLI_ERROR_CODES.SESSION_EXPIRED)).toMatchObject({
      code: CLI_ERROR_CODES.SESSION_EXPIRED,
    });
    expect(new LockError(CLI_ERROR_CODES.LOCK_TIMEOUT)).toMatchObject({
      code: CLI_ERROR_CODES.LOCK_TIMEOUT,
    });
  });

  it('rejects undefined codes at type level', () => {
    // @ts-expect-error UNKNOWN is intentionally not part of ICliErrorCode.
    expect(mapToExitCode('UNKNOWN')).toBe(2);
  });
});
