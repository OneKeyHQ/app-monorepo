import { executeAuthLogoutCommand } from './auth/auth-logout-command';

import type { OutputFormatter } from '../output';
import type { Command } from 'commander';

export function registerLogoutCommand(program: Command): void {
  program
    .command('logout')
    .description('Log out of the current auth session')
    .action(async (_options, command) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const globalOpts = command.optsWithGlobals() as Record<string, unknown>;
      const output = globalOpts._outputFormatter as OutputFormatter;

      await executeAuthLogoutCommand({
        output,
        skipConfirmation: Boolean(globalOpts.yes),
      });
    });
}
