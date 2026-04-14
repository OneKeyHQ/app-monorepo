import { executeMnemonicLoginCommand } from './auth/mnemonic-login-command';

import type { OutputFormatter } from '../output';
import type { Command } from 'commander';

export function registerImportCommand(program: Command): void {
  program
    .command('import')
    .description('Authenticate with a BIP39 mnemonic wallet')
    .option('--mnemonic', 'Authenticate with a BIP39 mnemonic phrase')
    .option(
      '--force',
      'Legacy compatibility flag; active sessions must still be logged out first',
    )
    .action(
      async (
        options: { mnemonic?: boolean; force?: boolean },
        command: Command,
      ) => {
        const globalOpts = command.optsWithGlobals();
        const output = globalOpts._outputFormatter as OutputFormatter;
        if (options.force && output.getMode() === 'human') {
          output.warn(
            '--force does not bypass active-session protection. Use onekey auth logout first.',
          );
        }

        await executeMnemonicLoginCommand({
          output,
          requiresMnemonicFlag: true,
          mnemonicFlag: options.mnemonic,
          missingMethodMessage: 'Import method required. Use --mnemonic.',
          missingMethodSuggestion: 'Run: onekey import --mnemonic',
        });
      },
    );
}
