import { executeAuthStatusCommand } from './auth-status-command';

import type { OutputFormatter } from '../../output';
import type { Command } from 'commander';

export function registerAuthStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Show the current auth session')
    .action(async (_options, command: Command) => {
      const globalOpts = command.optsWithGlobals();
      const output = globalOpts._outputFormatter as OutputFormatter;

      await executeAuthStatusCommand({ output });
    });
}
