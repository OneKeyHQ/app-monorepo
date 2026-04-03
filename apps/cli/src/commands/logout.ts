import { secureCache } from '../core';
import { AppError } from '../errors';
import { KeychainStorage } from '../infra/keychain-storage';
import { KEYCHAIN_ENCRYPTION_KEY, KEYCHAIN_MNEMONIC_KEY } from '../signer';

import type { OutputFormatter } from '../output';
import type { Command } from 'commander';

export function registerLogoutCommand(program: Command): void {
  program
    .command('logout')
    .description('Remove wallet from Keychain')
    .action(async (_options, command) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const globalOpts = command.optsWithGlobals() as Record<string, unknown>;
      const output = globalOpts._outputFormatter as OutputFormatter;

      try {
        const keychain = new KeychainStorage();
        await keychain.delete(KEYCHAIN_MNEMONIC_KEY);
        await keychain.delete(KEYCHAIN_ENCRYPTION_KEY);
        secureCache.clearAll();

        output.success({ status: 'logged_out' });
      } catch (error) {
        const appError = AppError.from(error);
        output.error(appError.toErrorDetail());
        process.exitCode = appError.exitCode;
      }
    });
}
