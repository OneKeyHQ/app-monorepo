import { Command } from 'commander';
import 'fake-indexeddb/auto';

import {
  registerBalanceCommand,
  registerImportCommand,
  registerLogoutCommand,
  registerStatusCommand,
  registerVersionCommand,
} from './commands';
import { secureCache } from './core';
import { apiClient } from './infra';
import { OutputFormatter } from './output';
import { createLogger } from './utils/logger';
import { detectOutputMode } from './utils/mode-detector';

const program = new Command();

program
  .name('onekey')
  .description('OneKey wallet CLI for developers and AI agents')
  .version('0.1.0', '-V, --version');

program
  .option('--json', 'Force JSON output')
  .option('--interactive', 'Force interactive (human) mode')
  .option('--verbose', 'Enable verbose logging')
  .option('--quiet', 'Suppress all non-essential output')
  .option('--env <env>', 'Environment: test | prod', 'test')
  .option('--yes', 'Skip confirmation prompts');

program.hook('preAction', (_thisCommand, actionCommand) => {
  const opts = actionCommand.optsWithGlobals();
  const mode = detectOutputMode({
    json: opts.json,
    interactive: opts.interactive,
    quiet: opts.quiet,
  });
  actionCommand.setOptionValue('_outputFormatter', new OutputFormatter(mode));
  const logger = createLogger({ verbose: opts.verbose, quiet: opts.quiet });
  actionCommand.setOptionValue('_logger', logger);
  apiClient.setEnv(opts.env ?? 'test');
  apiClient.setLogger(logger);
});

registerVersionCommand(program);
registerStatusCommand(program);
registerImportCommand(program);
registerLogoutCommand(program);
registerBalanceCommand(program);

const cleanup = () => {
  secureCache.clearAll();
  process.exit(0);
};
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('SIGHUP', cleanup);

program.parse();
