import { executeAuthLogoutCommand } from './auth-logout-command';

import type { OutputFormatter } from '../../output';
import type { Command } from 'commander';

export function registerAuthLogoutCommand(program: Command): void {
  program
    .command('logout')
    .description('Log out of the current auth session')
    .action(async (_options, command: Command) => {
      const globalOpts = command.optsWithGlobals();
      const output = globalOpts._outputFormatter as OutputFormatter;

      await executeAuthLogoutCommand({
        output,
        skipConfirmation: Boolean(globalOpts.yes),
      });
    });
}
