import {
  assertBtcImpl,
  listBtcAddressTypeInfos,
} from '../../core/btc/address-types';
import { resolveChain } from '../../core/chain-resolver';
import { AppError } from '../../errors';

import type { OutputFormatter } from '../../output';
import type { Command } from 'commander';

function formatAddressTypeInfo(chain: string, networkId: string, impl: string) {
  return listBtcAddressTypeInfos(impl).map((info) => ({
    chain,
    networkId,
    addressType: info.addressType,
    label: info.label,
    deriveType: info.deriveType,
    addressEncoding: info.addressEncoding,
    path: info.path,
    accountPath: info.accountPath,
    relPath: info.relPath,
  }));
}

export function registerWalletAddressTypesCommand(wallet: Command): void {
  wallet
    .command('address-types')
    .description('List supported BTC wallet address types')
    .requiredOption('--chain <chain>', 'Target Bitcoin chain: btc | tbtc')
    .action(async (options: { chain: string }, command) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const globalOpts = command.optsWithGlobals() as Record<string, unknown>;
      const output = globalOpts._outputFormatter as OutputFormatter;

      try {
        const chainConfig = resolveChain(options.chain);
        assertBtcImpl(chainConfig.impl);

        output.success(
          formatAddressTypeInfo(
            options.chain.toLowerCase(),
            chainConfig.networkId,
            chainConfig.impl,
          ),
          { chain: options.chain.toLowerCase() },
        );
      } catch (error) {
        const appError = AppError.from(error);
        output.error(appError.toErrorDetail());
        process.exitCode = appError.exitCode;
      }
    });
}
