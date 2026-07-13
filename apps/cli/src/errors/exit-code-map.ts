import { CLI_ERROR_CODES } from './codes';

import type { ICliErrorCode } from './codes';

export type ICliExitCode = 0 | 1 | 2;

export function mapToExitCode(code: ICliErrorCode): ICliExitCode {
  switch (code) {
    case CLI_ERROR_CODES.NOT_AUTHENTICATED:
    case CLI_ERROR_CODES.VAULT_MISSING:
    case CLI_ERROR_CODES.SESSION_EXPIRED:
    case CLI_ERROR_CODES.SERVICE_KEY_NOT_FOUND:
    case CLI_ERROR_CODES.INVALID_PAYLOAD:
    case CLI_ERROR_CODES.INVALID_TX:
    case CLI_ERROR_CODES.ADDRESS_NOT_DERIVED:
    case CLI_ERROR_CODES.UNKNOWN_COMMAND:
      return 1;

    case CLI_ERROR_CODES.VAULT_CORRUPT:
    case CLI_ERROR_CODES.SERVICE_UNREACHABLE:
    case CLI_ERROR_CODES.LOCK_TIMEOUT:
    case CLI_ERROR_CODES.CLOCK_BACK_DETECTED:
    case CLI_ERROR_CODES.VAULT_WRITE_FAILED:
    case CLI_ERROR_CODES.UNKNOWN_ERROR:
      return 2;

    default: {
      const exhaustive: never = code;
      void exhaustive;
      return 2;
    }
  }
}
