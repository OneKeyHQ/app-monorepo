import { ERROR_CODES, getExitCode } from './error-codes';

export interface IErrorDetail {
  code: string;
  message: string;
  suggestion: string;
  details?: Record<string, unknown>;
}

export class AppError extends Error {
  readonly code: string;

  readonly suggestion: string;

  readonly details?: Record<string, unknown>;

  readonly exitCode: number;

  constructor(
    code: string,
    message: string,
    suggestion: string,
    options?: { details?: Record<string, unknown>; cause?: unknown },
  ) {
    super(
      message,
      options?.cause !== undefined ? { cause: options.cause } : undefined,
    );
    this.name = 'AppError';
    this.code = code;
    this.suggestion = suggestion;
    this.details = options?.details;
    this.exitCode = getExitCode(code);
  }

  toErrorDetail(): IErrorDetail {
    return {
      code: this.code,
      message: this.message,
      suggestion: this.suggestion,
      ...(this.details ? { details: this.details } : {}),
    };
  }

  static from(error: unknown): AppError {
    if (error instanceof AppError) return error;
    if (error instanceof Error) {
      // Zod validation errors — map to the appropriate PARAM code
      if (error.name === 'ZodError') {
        const zodErr = error as Error & {
          errors?: Array<{ path: (string | number)[]; message: string }>;
        };
        const firstIssue = zodErr.errors?.[0];
        const message = firstIssue?.message ?? error.message;
        const path = firstIssue?.path ?? [];

        let code: string = ERROR_CODES.PARAM_MISSING_REQUIRED.code;
        if (path.some((p) => p === 'to' || p === 'token')) {
          code = ERROR_CODES.PARAM_INVALID_ADDRESS.code;
        } else if (path.some((p) => p === 'amount')) {
          code = ERROR_CODES.PARAM_INVALID_AMOUNT.code;
        } else if (path.some((p) => p === 'chain')) {
          code = ERROR_CODES.PARAM_INVALID_CHAIN.code;
        }

        return new AppError(
          code,
          message,
          'Check the input parameters and retry',
          {
            cause: error,
          },
        );
      }

      // Mnemonic validation errors
      if (
        error.message.includes('InvalidMnemonic') ||
        error.message.includes('invalid_phrases')
      ) {
        return new AppError(
          ERROR_CODES.PARAM_INVALID_MNEMONIC.code,
          'Invalid BIP39 mnemonic phrase',
          'Verify all words are correct and in the right order',
          { cause: error },
        );
      }

      return new AppError(
        ERROR_CODES.BIZ_UNKNOWN.code,
        error.message,
        'Check the error details and retry',
        { cause: error },
      );
    }
    return new AppError(
      ERROR_CODES.BIZ_UNKNOWN.code,
      String(error),
      'Check the error details and retry',
    );
  }
}
