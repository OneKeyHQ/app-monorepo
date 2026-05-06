import {
  CLI_ERROR_CODES,
  ERROR_CODES,
  getExitCode,
  mapToExitCode,
} from './errors';
import { formatError } from './output/format';
import { formatHumanError } from './output/human-formatter';

import type { ICliErrorCode } from './errors';
import type { ICliOutputFormat } from './output/format';

type IErrorWithCode = Error & {
  code?: unknown;
  exitCode?: unknown;
};

type IWritableStreamLike = {
  write: (chunk: string) => unknown;
};

type ICliTopLevelErrorOutputMode = ICliOutputFormat | 'human' | 'quiet';

export type INormalizedCliTopLevelError = {
  code: string;
  exitCode: number;
  message: string;
};

export type IEmitCliTopLevelErrorOptions = {
  argv?: readonly string[];
  format?: ICliOutputFormat;
  isTTY?: boolean;
  stderr?: IWritableStreamLike;
  stdout?: IWritableStreamLike;
};

const CLI_ERROR_CODE_VALUES: ReadonlySet<string> = new Set(
  Object.values(CLI_ERROR_CODES),
);

const APP_ERROR_CODE_VALUES: ReadonlySet<string> = new Set(
  Object.values(ERROR_CODES).map((entry) => entry.code),
);

const COMMANDER_MISSING_PARAM_CODES: ReadonlySet<string> = new Set([
  'commander.missingArgument',
  'commander.missingMandatoryOptionValue',
  'commander.optionMissingArgument',
]);

const COMMANDER_INVALID_PARAM_CODES: ReadonlySet<string> = new Set([
  'commander.conflictingOption',
  'commander.excessArguments',
  'commander.invalidArgument',
  'commander.unknownOption',
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isCliErrorCode(value: unknown): value is ICliErrorCode {
  return typeof value === 'string' && CLI_ERROR_CODE_VALUES.has(value);
}

function isAppErrorCode(value: unknown): value is string {
  return typeof value === 'string' && APP_ERROR_CODE_VALUES.has(value);
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

function getCommanderParamErrorCode(error: IErrorWithCode): string | undefined {
  if (typeof error.code !== 'string') {
    return undefined;
  }

  if (COMMANDER_MISSING_PARAM_CODES.has(error.code)) {
    return ERROR_CODES.PARAM_MISSING_REQUIRED.code;
  }

  if (COMMANDER_INVALID_PARAM_CODES.has(error.code)) {
    return ERROR_CODES.PARAM_INVALID_COMMAND.code;
  }

  return undefined;
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

  if (errorWithCode) {
    const code = getCommanderParamErrorCode(errorWithCode);
    if (code) {
      const message =
        trimCommanderErrorPrefix(errorWithCode.message) || 'Invalid command';
      return {
        code,
        exitCode: getExitCode(code),
        message,
      };
    }
  }

  if (errorWithCode && isCliErrorCode(errorWithCode.code)) {
    const code = errorWithCode.code;
    return {
      code,
      exitCode: mapToExitCode(code),
      message: errorWithCode.message || code,
    };
  }

  if (errorWithCode && isAppErrorCode(errorWithCode.code)) {
    const code = errorWithCode.code;
    return {
      code,
      exitCode: getExitCode(code),
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

function getTopLevelErrorSuggestion(code: string): string {
  if (code === CLI_ERROR_CODES.UNKNOWN_COMMAND) {
    return 'Run: onekey --help';
  }

  if (code.startsWith('PARAM_')) {
    return 'Check the input parameters and retry';
  }

  return 'Check the error details and retry';
}

export function resolveCliErrorOutputMode(
  argv: readonly string[] = process.argv.slice(2),
  isTTY = process.stdout.isTTY === true,
): ICliTopLevelErrorOutputMode {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--quiet') {
      return 'quiet';
    }

    if (arg === '--interactive') {
      return 'human';
    }

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

  return isTTY ? 'human' : 'json';
}

export function resolveCliErrorOutputFormat(
  argv: readonly string[] = process.argv.slice(2),
  isTTY = process.stdout.isTTY === true,
): ICliOutputFormat {
  const mode = resolveCliErrorOutputMode(argv, isTTY);
  if (mode === 'json') {
    return 'json';
  }
  return 'text';
}

export function emitCliTopLevelError(
  error: unknown,
  options: IEmitCliTopLevelErrorOptions = {},
): INormalizedCliTopLevelError {
  const normalized = normalizeCliTopLevelError(error);
  const mode =
    options.format ??
    resolveCliErrorOutputMode(options.argv ?? undefined, options.isTTY);
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;

  if (mode === 'json') {
    stdout.write(
      `${formatError(normalized.code, normalized.message, 'json')}\n`,
    );
  } else if (mode === 'quiet') {
    stderr.write(`${normalized.code}: ${normalized.message}\n`);
  } else if (mode === 'human') {
    stderr.write(
      `${formatHumanError({
        code: normalized.code,
        message: normalized.message,
        suggestion: getTopLevelErrorSuggestion(normalized.code),
      })}\n`,
    );
  } else {
    stderr.write(
      `${formatError(normalized.code, normalized.message, 'text')}\n`,
    );
  }

  process.exitCode = normalized.exitCode;

  return normalized;
}
