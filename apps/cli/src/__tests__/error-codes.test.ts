import { AppError } from '../errors/app-error';
import { ERROR_CODES, EXIT_CODES, getExitCode } from '../errors/error-codes';

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

  it('maps new SEC_ error codes to exit code 5', () => {
    expect(getExitCode('SEC_HIGH_RISK_TOKEN')).toBe(EXIT_CODES.SEC);
    expect(ERROR_CODES.SEC_HIGH_RISK_TOKEN.exitCode).toBe(EXIT_CODES.SEC);
  });

  it('maps new BIZ_ swap/token error codes to exit code 1', () => {
    expect(getExitCode('BIZ_SWAP_SLIPPAGE')).toBe(EXIT_CODES.BIZ);
    expect(getExitCode('BIZ_SWAP_EXPIRED')).toBe(EXIT_CODES.BIZ);
    expect(getExitCode('BIZ_SWAP_FAILED')).toBe(EXIT_CODES.BIZ);
    expect(getExitCode('BIZ_TOKEN_NOT_FOUND')).toBe(EXIT_CODES.BIZ);
    expect(ERROR_CODES.BIZ_SWAP_SLIPPAGE.exitCode).toBe(EXIT_CODES.BIZ);
    expect(ERROR_CODES.BIZ_SWAP_EXPIRED.exitCode).toBe(EXIT_CODES.BIZ);
    expect(ERROR_CODES.BIZ_SWAP_FAILED.exitCode).toBe(EXIT_CODES.BIZ);
    expect(ERROR_CODES.BIZ_TOKEN_NOT_FOUND.exitCode).toBe(EXIT_CODES.BIZ);
  });

  it('all ERROR_CODES have valid code strings', () => {
    for (const entry of Object.values(ERROR_CODES)) {
      expect(typeof entry.code).toBe('string');
      expect(entry.code.length).toBeGreaterThan(0);
      expect(typeof entry.exitCode).toBe('number');
    }
  });
});

describe('AppError.from()', () => {
  it('returns the same AppError instance unchanged', () => {
    const original = new AppError(
      ERROR_CODES.BIZ_UNKNOWN.code,
      'msg',
      'suggestion',
    );
    expect(AppError.from(original)).toBe(original);
  });

  it('maps ZodError on address field to PARAM_INVALID_ADDRESS', () => {
    const zodErr = Object.assign(new Error('Invalid Ethereum address'), {
      name: 'ZodError',
      errors: [{ path: ['to'], message: 'Invalid Ethereum address' }],
    });
    const appErr = AppError.from(zodErr);
    expect(appErr.code).toBe(ERROR_CODES.PARAM_INVALID_ADDRESS.code);
    expect(appErr.exitCode).toBe(EXIT_CODES.PARAM);
  });

  it('maps ZodError on token field to PARAM_INVALID_ADDRESS', () => {
    const zodErr = Object.assign(new Error('Invalid Ethereum address'), {
      name: 'ZodError',
      errors: [{ path: ['token'], message: 'Invalid Ethereum address' }],
    });
    expect(AppError.from(zodErr).code).toBe(
      ERROR_CODES.PARAM_INVALID_ADDRESS.code,
    );
  });

  it('maps ZodError on amount field to PARAM_INVALID_AMOUNT', () => {
    const zodErr = Object.assign(
      new Error('Amount must be a positive number'),
      {
        name: 'ZodError',
        errors: [
          { path: ['amount'], message: 'Amount must be a positive number' },
        ],
      },
    );
    const appErr = AppError.from(zodErr);
    expect(appErr.code).toBe(ERROR_CODES.PARAM_INVALID_AMOUNT.code);
    expect(appErr.exitCode).toBe(EXIT_CODES.PARAM);
  });

  it('maps ZodError on chain field to PARAM_INVALID_CHAIN', () => {
    const zodErr = Object.assign(new Error('invalid chain'), {
      name: 'ZodError',
      errors: [{ path: ['chain'], message: 'invalid chain' }],
    });
    expect(AppError.from(zodErr).code).toBe(
      ERROR_CODES.PARAM_INVALID_CHAIN.code,
    );
  });

  it('maps unknown ZodError to PARAM_MISSING_REQUIRED', () => {
    const zodErr = Object.assign(new Error('required'), {
      name: 'ZodError',
      errors: [{ path: [], message: 'required' }],
    });
    expect(AppError.from(zodErr).code).toBe(
      ERROR_CODES.PARAM_MISSING_REQUIRED.code,
    );
  });

  it('maps InvalidMnemonic error to PARAM_INVALID_MNEMONIC', () => {
    const mnemonicErr = new Error('InvalidMnemonic feedback.invalid_phrases');
    const appErr = AppError.from(mnemonicErr);
    expect(appErr.code).toBe(ERROR_CODES.PARAM_INVALID_MNEMONIC.code);
    expect(appErr.exitCode).toBe(EXIT_CODES.PARAM);
    expect(appErr.message).toBe('Invalid BIP39 mnemonic phrase');
  });

  it('falls back to BIZ_UNKNOWN for generic errors', () => {
    const err = new Error('something unexpected happened');
    expect(AppError.from(err).code).toBe(ERROR_CODES.BIZ_UNKNOWN.code);
  });

  it('wraps non-Error values as BIZ_UNKNOWN', () => {
    expect(AppError.from('raw string').code).toBe(ERROR_CODES.BIZ_UNKNOWN.code);
    expect(AppError.from(42).code).toBe(ERROR_CODES.BIZ_UNKNOWN.code);
  });
});
