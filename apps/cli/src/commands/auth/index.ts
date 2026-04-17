import { AppError, ERROR_CODES } from '../../errors';
import { OutputFormatter } from '../../output';
import { detectOutputMode } from '../../utils/mode-detector';

import { registerAuthLoginCommand } from './auth-login';
import { registerAuthLogoutCommand } from './auth-logout';
import { registerAuthStatusCommand } from './auth-status';

import type { Command } from 'commander';

const AUTH_SUBCOMMANDS = new Set(['login', 'logout', 'status', 'help']);

function emitAuthDiscoveryError(output: OutputFormatter, appError: AppError) {
  output.error(appError.toErrorDetail());
  process.exitCode = appError.exitCode;
  return true;
}

function parseAuthDiscoveryArgs(argv: string[]) {
  const positionals: string[] = [];
  let json = false;
  let interactive = false;
  let quiet = false;
  let env: string | undefined;
  let hasHelp = false;
  let envError: AppError | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--json') {
      json = true;
    } else if (arg === '--interactive') {
      interactive = true;
    } else if (arg === '--quiet') {
      quiet = true;
    } else if (arg === '--env') {
      const envValue = argv[index + 1];
      if (!envValue || envValue.startsWith('-')) {
        envError = new AppError(
          ERROR_CODES.PARAM_MISSING_REQUIRED.code,
          'Missing --env value',
          'Valid values: test | prod',
        );
      } else {
        env = envValue;
        index += 1;
      }
    } else if (arg.startsWith('--env=')) {
      env = arg.slice('--env='.length);
    } else if (arg === '--verbose' || arg === '--yes') {
      // Ignore global flags that do not affect auth fallback routing.
    } else if (arg === '-h' || arg === '--help') {
      hasHelp = true;
    } else if (!arg.startsWith('-')) {
      positionals.push(arg);
    }
  }

  return {
    env,
    hasHelp,
    interactive,
    json,
    positionals,
    quiet,
    envError,
  };
}

export function handleAuthCommandDiscoveryFallback(argv: string[]): boolean {
  const { positionals, json, interactive, quiet, env, hasHelp, envError } =
    parseAuthDiscoveryArgs(argv);

  if (positionals[0] !== 'auth' || hasHelp) {
    return false;
  }

  const output = new OutputFormatter(
    detectOutputMode({ json, interactive, quiet }),
  );

  if (envError) {
    return emitAuthDiscoveryError(output, envError);
  }

  if (env && env !== 'test' && env !== 'prod') {
    return emitAuthDiscoveryError(
      output,
      new AppError(
        ERROR_CODES.PARAM_INVALID_CONFIG.code,
        `Invalid --env value: "${env}"`,
        'Valid values: test | prod',
      ),
    );
  }

  const subcommand = positionals[1];

  if (!subcommand) {
    if (!json && !quiet) {
      return false;
    }

    return emitAuthDiscoveryError(
      output,
      new AppError(
        ERROR_CODES.PARAM_MISSING_REQUIRED.code,
        'Auth subcommand is required',
        'Use "onekey auth --help" to list available subcommands.',
      ),
    );
  }

  if (!AUTH_SUBCOMMANDS.has(subcommand)) {
    return emitAuthDiscoveryError(
      output,
      new AppError(
        ERROR_CODES.PARAM_INVALID_COMMAND.code,
        `Unknown auth subcommand: ${subcommand}`,
        'Supported auth subcommands: login | logout | status',
      ),
    );
  }

  return false;
}

export function registerAuthCommands(program: Command): void {
  const auth = program
    .command('auth')
    .description('Authenticate with a mnemonic or OneKey App Bot Wallet');

  registerAuthLoginCommand(auth);
  registerAuthLogoutCommand(auth);
  registerAuthStatusCommand(auth);
}
