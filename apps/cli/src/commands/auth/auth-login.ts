import { executeAuthLoginCommand } from './auth-login-command';

import type { OutputFormatter } from '../../output';
import type { Command } from 'commander';

export function registerAuthLoginCommand(program: Command): void {
  program
    .command('login')
    .description('Authenticate with a OneKey App Bot Wallet or hardware device')
    .option('--app-transfer', 'Authenticate with a OneKey App Bot Wallet')
    .option(
      '--hardware',
      'Authenticate with a connected hardware wallet device',
    )
    .action(
      async (
        options: { appTransfer?: boolean; hardware?: boolean },
        command: Command,
      ) => {
        const globalOpts = command.optsWithGlobals();
        const output = globalOpts._outputFormatter as OutputFormatter;

        await executeAuthLoginCommand({
          output,
          appTransferFlag: options.appTransfer,
          hardwareFlag: options.hardware,
          isHumanMode: output.getMode() === 'human',
          isTTY: Boolean(process.stdin.isTTY && process.stdout.isTTY),
          env: (globalOpts.env as 'test' | 'prod' | undefined) ?? 'prod',
          exit: (code) => process.exit(code),
        });
      },
    );
}
