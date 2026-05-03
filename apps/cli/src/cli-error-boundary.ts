import { CLI_ERROR_CODES, mapToExitCode } from './errors';
import { formatError } from './output/format';

import type { ICliErrorCode, ICliExitCode } from './errors';
import type { ICliOutputFormat } from './output/format';

type IErrorWithCode = Error & {
  code?: unknown;
  exitCode?: unknown;
};

type IWritableStreamLike = {
  write: (chunk: string) => unknown;
};

export type INormalizedCliTopLevelError = {
  code: ICliErrorCode;
  exitCode: ICliExitCode;
  message: string;
};

export type IEmitCliTopLevelErrorOptions = {
  argv?: readonly string[];
  format?: ICliOutputFormat;
  isTTY?: boolean;
  stdout?: IWritableStreamLike;
};

const CLI_ERROR_CODE_VALUES: ReadonlySet<string> = new Set(
  Object.values(CLI_ERROR_CODES),
);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isCliErrorCode(value: unknown): value is ICliErrorCode {
  return typeof value === 'string' && CLI_ERROR_CODE_VALUES.has(value);
}

function getErrorWithCode(error: unknown): IErrorWithCode | undefined {
  if (error instanceof Error) {
    return error as IErrorWithCode;
  }
  if (isObject(error)) {
    const maybeError = error as Partial<IErrorWithCode>;
    if (typeof maybeError.message === 'string') {
      return maybeError as IErrorWithCode;
    }
  }
  return undefined;
}

function trimCommanderErrorPrefix(message: string): string {
  return message.replace(/^error:\s*/i, '').trim();
}

function isCommanderUnknownCommand(error: IErrorWithCode): boolean {
  return error.code === 'commander.unknownCommand';
}

export function getCommanderPassthroughExitCode(
  error: unknown,
): number | undefined {
  const errorWithCode = getErrorWithCode(error);
  if (!errorWithCode) {
    return undefined;
  }

  if (
    errorWithCode.code !== 'commander.help' &&
    errorWithCode.code !== 'commander.helpDisplayed' &&
    errorWithCode.code !== 'commander.version'
  ) {
    return undefined;
  }

  return typeof errorWithCode.exitCode === 'number'
    ? errorWithCode.exitCode
    : 0;
}

export function isCommanderPassthroughError(error: unknown): boolean {
  return getCommanderPassthroughExitCode(error) !== undefined;
}

export function normalizeCliTopLevelError(
  error: unknown,
): INormalizedCliTopLevelError {
  const errorWithCode = getErrorWithCode(error);

  if (errorWithCode && isCommanderUnknownCommand(errorWithCode)) {
    const message =
      trimCommanderErrorPrefix(errorWithCode.message) || 'Unknown command';
    const code = CLI_ERROR_CODES.UNKNOWN_COMMAND;
    return {
      code,
      exitCode: mapToExitCode(code),
      message,
    };
  }

  if (errorWithCode && isCliErrorCode(errorWithCode.code)) {
    const code = errorWithCode.code;
    return {
      code,
      exitCode: mapToExitCode(code),
      message: errorWithCode.message || code,
    };
  }

  const code = CLI_ERROR_CODES.UNKNOWN_ERROR;
  return {
    code,
    exitCode: mapToExitCode(code),
    message: 'Unexpected CLI error',
  };
}

export function resolveCliErrorOutputFormat(
  argv: readonly string[] = process.argv.slice(2),
): ICliOutputFormat {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--format') {
      const value = argv[index + 1];
      if (value === 'text' || value === 'json') {
        return value;
      }
    }

    if (arg === '--format=text') {
      return 'text';
    }

    if (arg === '--format=json' || arg === '--json') {
      return 'json';
    }
  }

  return 'json';
}

export function emitCliTopLevelError(
  error: unknown,
  options: IEmitCliTopLevelErrorOptions = {},
): INormalizedCliTopLevelError {
  const normalized = normalizeCliTopLevelError(error);
  const format =
    options.format ?? resolveCliErrorOutputFormat(options.argv ?? undefined);
  const stdout = options.stdout ?? process.stdout;

  stdout.write(`${formatError(normalized.code, normalized.message, format)}\n`);
  process.exitCode = normalized.exitCode;

  return normalized;
}
