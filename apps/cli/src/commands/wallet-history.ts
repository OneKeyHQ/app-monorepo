import { assertAddressForChain } from '../core/address-utils';
import {
  assertChainCapability,
  isEvmChain,
  resolveChain,
} from '../core/chain-resolver';
import { fetchHistory, formatHistoryList } from '../core/history-fetcher';
import { resolveToken } from '../core/token-resolver';
import { AppError, ERROR_CODES } from '../errors';
import { getSignerByImpl } from '../signer';

import type { IHistoryItem } from '../core/history-fetcher';
import type { OutputFormatter } from '../output';
import type { Command } from 'commander';

export function registerWalletHistoryCommand(program: Command): void {
  program
    .command('history')
    .description('List on-chain transaction history')
    .requiredOption('--chain <chain>', 'Target blockchain (e.g., eth, bsc)')
    .option('--token <token>', 'Filter by token symbol or contract address')
    .option('--address <address>', 'Override wallet address to query')
    .option('--limit <n>', 'Max records (default 20, max 50)', '20')
    .option('--detail', 'Include detail fields (block, nonce, confirmations)')
    .action(
      async (
        options: {
          chain: string;
          token?: string;
          address?: string;
          limit: string;
          detail?: boolean;
        },
        command,
      ) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        const globalOpts = command.optsWithGlobals() as Record<string, unknown>;
        const output = globalOpts._outputFormatter as OutputFormatter;

        try {
          const chainConfig = resolveChain(options.chain);
          assertChainCapability(chainConfig, 'historyRead', 'history');

          // Resolve wallet address
          let address = options.address;
          if (!isEvmChain(chainConfig)) {
            if (!address) {
              throw new AppError(
                ERROR_CODES.PARAM_MISSING_REQUIRED.code,
                'BTC read-only history currently requires --address.',
                'Pass --address with a valid BTC or Bitcoin testnet address.',
              );
            }

            if (options.token) {
              throw new AppError(
                ERROR_CODES.PARAM_INVALID_TOKEN.code,
                'Token filtering is not supported for BTC/TBTC history in this round.',
                'Omit --token to query native BTC/TBTC history.',
              );
            }

            address = assertAddressForChain(chainConfig, address);
          } else if (!address) {
            const signer = await getSignerByImpl(chainConfig.impl);
            const addrInfo = await signer.getAddress(chainConfig.networkId);
            address = addrInfo.address;
          } else {
            address = assertAddressForChain(chainConfig, address);
          }

          // Resolve token filter
          let tokenAddress: string | undefined;
          if (options.token) {
            const resolved = await resolveToken(options.token, options.chain);
            tokenAddress = resolved.isNative ? '' : resolved.contractAddress;
          }

          const limit = Math.max(
            1,
            Math.min(50, parseInt(options.limit, 10) || 20),
          );
          const detail = options.detail ?? false;

          const resp = await fetchHistory({
            networkId: chainConfig.networkId,
            accountAddress: address,
            tokenAddress,
            limit,
          });

          let items: IHistoryItem[] = formatHistoryList(resp, detail);

          // Set networkName for detail mode
          if (detail) {
            items = items.map((item) => ({
              ...item,
              networkName: chainConfig.nativeSymbol,
            }));
          }

          output.success(items, {
            chain: options.chain,
            address,
            count: items.length,
            hasMore: resp.hasMore ?? false,
          });
        } catch (error) {
          const appError = AppError.from(error);
          output.error(appError.toErrorDetail());
          process.exitCode = appError.exitCode;
        }
      },
    );
}
