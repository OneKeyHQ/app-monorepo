import { getExitCode, ERROR_CODES } from './error-codes';

export interface ErrorDetail {
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

  toErrorDetail(): ErrorDetail {
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
