import { AppError, ERROR_CODES } from '../errors';
import { VaultClient, createVaultAddressCacheKey } from '../infra/vault';

import type { OutputFormatter } from '../output';
import type { Command } from 'commander';

type IGetAddressFormat = 'json' | 'text';

type IGetAddressOptions = {
  format?: IGetAddressFormat;
};

type IGetAddressDependencies = {
  output: Pick<OutputFormatter, 'error' | 'raw' | 'success'>;
  vaultClient?: Pick<VaultClient, 'readOnly'>;
};

function maskAddress(address: string): string {
  if (address.length <= 14) {
    return address;
  }
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

function createNotAuthenticatedError(): AppError {
  return new AppError(
    ERROR_CODES.NOT_AUTHENTICATED.code,
    'No authenticated wallet found. Log in first.',
    'Run: onekey auth login --app-transfer',
  );
}

function createAddressNotDerivedError(): AppError {
  return new AppError(
    ERROR_CODES.ADDRESS_NOT_DERIVED.code,
    'Address has not been derived for the active Bot Wallet.',
    'Run auth login again to import a fresh Bot Wallet payload.',
  );
}

export async function executeGetAddressCommand(
  options: IGetAddressOptions,
  dependencies: IGetAddressDependencies,
): Promise<void> {
  const vaultClient = dependencies.vaultClient ?? new VaultClient();
  const format = options.format ?? 'json';

  try {
    const address = await vaultClient.readOnly((vault) => {
      const activeWalletId = vault.metadata.activeWalletId;
      const activeKeyId = vault.metadata.activeKeyId;
      if (!activeWalletId || !activeKeyId) {
        throw createNotAuthenticatedError();
      }

      const addressEntry =
        vault.cache[createVaultAddressCacheKey(activeWalletId, activeKeyId)];
      if (!addressEntry) {
        throw createAddressNotDerivedError();
      }

      return addressEntry.hdCredentialBlob;
    });

    if (format === 'text') {
      dependencies.output.raw(address);
      return;
    }

    dependencies.output.success({
      address: maskAddress(address),
    });
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error.code === 'NOT_AUTHENTICATED' || error.code === 'VAULT_MISSING')
    ) {
      const appError = createNotAuthenticatedError();
      dependencies.output.error(appError.toErrorDetail());
      process.exitCode = appError.exitCode;
      return;
    }

    const appError = AppError.from(error);
    dependencies.output.error(appError.toErrorDetail());
    process.exitCode = appError.exitCode;
  }
}

export function registerGetAddressCommand(program: Command): void {
  program
    .command('get-address')
    .description('Show the active Bot Wallet address')
    .option('--format <format>', 'Output format: json | text', 'json')
    .action(async (options: IGetAddressOptions, command: Command) => {
      const globalOpts = command.optsWithGlobals();
      const output = globalOpts._outputFormatter as OutputFormatter;
      await executeGetAddressCommand(options, { output });
    });
}
