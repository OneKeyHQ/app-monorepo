import { Command } from 'commander';
import 'fake-indexeddb/auto';

import { version as PKG_VERSION } from '../package.json';

import {
  handleAuthCommandDiscoveryFallback,
  registerAuthCommands,
  registerBalanceCommand,
  registerDeviceCommands,
  registerLogoutCommand,
  registerMarketCommands,
  registerSchemaCommand,
  registerSecurityCommands,
  registerStatusCommand,
  registerSwapCommands,
  registerTokenCommands,
  registerTransferCommand,
  registerVersionCommand,
  registerWalletHistoryCommand,
} from './commands';
import { disposeSDK } from './commands/device/hardware-sdk';
import { secureCache } from './core';
import { createSignalCleanupHandler } from './core/auth/auth-flow-interruption';
import { ERROR_CODES } from './errors';
import { apiClient } from './infra';
import { OutputFormatter } from './output';
import './schemas/register-all';
import { createLogger } from './utils/logger';
import { detectOutputMode } from './utils/mode-detector';

import type { IEndpointEnv } from './config';

const program = new Command();

program
  .name('onekey')
  .description('OneKey wallet CLI for developers and AI agents')
  .version(PKG_VERSION, '-V, --version');

program
  .option('--json', 'Force JSON output')
  .option('--interactive', 'Force interactive (human) mode')
  .option('--verbose', 'Enable verbose logging')
  .option('--quiet', 'Suppress all non-essential output')
  .option('--env <env>', 'Environment: test | prod', 'prod')
  .option('--yes', 'Skip confirmation prompts');

program.hook('preAction', (_thisCommand, actionCommand) => {
  const opts = actionCommand.optsWithGlobals();
  const mode = detectOutputMode({
    json: opts.json,
    interactive: opts.interactive,
    quiet: opts.quiet,
  });
  const output = new OutputFormatter(mode);

  const env = (opts.env ?? 'prod') as string;
  if (env !== 'test' && env !== 'prod') {
    output.error({
      code: ERROR_CODES.PARAM_INVALID_CONFIG.code,
      message: `Invalid --env value: "${env}"`,
      suggestion: 'Valid values: test | prod',
    });
    process.exit(ERROR_CODES.PARAM_INVALID_CONFIG.exitCode);
  }

  actionCommand.setOptionValue('_outputFormatter', output);
  const logger = createLogger({ verbose: opts.verbose, quiet: opts.quiet });
  actionCommand.setOptionValue('_logger', logger);
  apiClient.setEnv(env as IEndpointEnv);
  apiClient.setLogger(logger);
});

registerVersionCommand(program);
registerStatusCommand(program);
registerLogoutCommand(program);
registerBalanceCommand(program);
registerTransferCommand(program);
registerAuthCommands(program);

// Phase 3A command groups
registerTokenCommands(program);
registerMarketCommands(program);
registerSwapCommands(program);
registerSecurityCommands(program);
registerWalletHistoryCommand(program);
registerSchemaCommand(program);
registerDeviceCommands(program);

// Signal handlers: use Unix-conventional exit codes (128 + signal number).
// disposeHardwareSdk releases the USB transport — otherwise Node hangs ~26s
// waiting on open handles (poll timers, event listeners).
process.on(
  'SIGINT',
  createSignalCleanupHandler({
    exitCode: 130,
    clearSecureCache: () => secureCache.clearAll(),
    disposeHardwareSdk: () => disposeSDK(),
  }),
);
process.on(
  'SIGTERM',
  createSignalCleanupHandler({
    exitCode: 143,
    clearSecureCache: () => secureCache.clearAll(),
    disposeHardwareSdk: () => disposeSDK(),
  }),
);
process.on(
  'SIGHUP',
  createSignalCleanupHandler({
    exitCode: 129,
    clearSecureCache: () => secureCache.clearAll(),
    disposeHardwareSdk: () => disposeSDK(),
  }),
);

// Normal exit path: Commander actions set process.exitCode and return.
// The USB transport keeps the event loop alive (poll timers + libusb
// native handles), so Node never idles and `beforeExit` never fires.
// We have to dispose explicitly — Commander's `postAction` runs right
// after the command's action promise resolves, then we force-exit to
// cover any other lingering handles.
program.hook('postAction', async () => {
  try {
    await disposeSDK();
  } catch {
    // Best-effort — dispose errors shouldn't block exit.
  }
});

async function main(): Promise<void> {
  if (handleAuthCommandDiscoveryFallback(process.argv.slice(2))) {
    return;
  }
  await program.parseAsync();
}

void main().finally(() => {
  // Force exit: `postAction` disposed the SDK, but some third-party
  // handles (e.g. fake-indexeddb, axios keep-alive sockets) may still
  // delay idle detection. An explicit exit keeps command turnaround snappy.
  process.exit(process.exitCode ?? 0);
});
