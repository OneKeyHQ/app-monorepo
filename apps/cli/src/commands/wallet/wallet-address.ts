import {
  assertBtcImpl,
  getBtcAddressTypeInfo,
} from '../../core/btc/address-types';
import { resolveChain } from '../../core/chain-resolver';
import { AppError, ERROR_CODES } from '../../errors';
import { getSignerByImpl } from '../../signer';

import type { BtcAddressType } from '../../core/btc/address-types';
import type { OutputFormatter } from '../../output';
import type { Command } from 'commander';

function getPublicKey(addressInfo: unknown): string | undefined {
  if (!addressInfo || typeof addressInfo !== 'object') return undefined;

  const record = addressInfo as Record<string, unknown>;
  const value = record.publicKey ?? record.pub;
  return typeof value === 'string' ? value : undefined;
}

export function registerWalletAddressCommand(wallet: Command): void {
  wallet
    .command('address')
    .description('Derive a BTC wallet address')
    .requiredOption('--chain <chain>', 'Target Bitcoin chain: btc | tbtc')
    .option('--address-type <type>', 'BTC address type')
    .action(
      async (
        options: { chain: string; addressType?: BtcAddressType },
        command,
      ) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        const globalOpts = command.optsWithGlobals() as Record<string, unknown>;
        const output = globalOpts._outputFormatter as OutputFormatter;

        try {
          if (!options.addressType) {
            throw new AppError(
              ERROR_CODES.PARAM_MISSING_REQUIRED.code,
              'Missing required option --address-type.',
              'Use one of: taproot, native-segwit, nested-segwit, legacy.',
            );
          }

          const chainConfig = resolveChain(options.chain);
          assertBtcImpl(chainConfig.impl);

          const info = getBtcAddressTypeInfo(
            chainConfig.impl,
            options.addressType,
          );
          const signer = await getSignerByImpl(chainConfig.impl);
          const addressInfo = await signer.getAddress(chainConfig.networkId, {
            addressType: options.addressType,
          });
          const publicKey = getPublicKey(addressInfo);

          output.success(
            {
              chain: options.chain.toLowerCase(),
              networkId: chainConfig.networkId,
              addressType: info.addressType,
              label: info.label,
              deriveType: info.deriveType,
              addressEncoding: info.addressEncoding,
              path: info.path,
              accountPath: info.accountPath,
              relPath: info.relPath,
              address: addressInfo.address,
              ...(publicKey ? { publicKey } : {}),
            },
            { chain: options.chain.toLowerCase() },
          );
        } catch (error) {
          const appError = AppError.from(error);
          output.error(appError.toErrorDetail());
          process.exitCode = appError.exitCode;
        }
      },
    );
}
