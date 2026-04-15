import { executeAuthLoginCommand } from './auth-login-command';

import type { OutputFormatter } from '../../output';
import type { Command } from 'commander';

export function registerAuthLoginCommand(program: Command): void {
  program
    .command('login')
    .description('Authenticate with a mnemonic or OneKey App Bot Wallet')
    .option('--mnemonic', 'Authenticate with a BIP39 mnemonic phrase')
    .option('--app-transfer', 'Authenticate with a OneKey App Bot Wallet')
    .action(
      async (
        options: { mnemonic?: boolean; appTransfer?: boolean },
        command: Command,
      ) => {
        const globalOpts = command.optsWithGlobals();
        const output = globalOpts._outputFormatter as OutputFormatter;

        await executeAuthLoginCommand({
          output,
          mnemonicFlag: options.mnemonic,
          appTransferFlag: options.appTransfer,
          isHumanMode: output.getMode() === 'human',
          isTTY: Boolean(process.stdin.isTTY && process.stdout.isTTY),
          env: (globalOpts.env as 'test' | 'prod' | undefined) ?? 'test',
          exit: (code) => process.exit(code),
        });
      },
    );
}
