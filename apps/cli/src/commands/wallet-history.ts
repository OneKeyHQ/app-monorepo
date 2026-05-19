import { assertAddressForChain } from '../core/address-utils';
import {
  fetchBtcDerivedHistory,
  fetchBtcExternalAddressHistory,
} from '../core/btc/account';
import { isBtcImpl } from '../core/btc/address-types';
import { assertChainCapability, resolveChain } from '../core/chain-resolver';
import { fetchHistory, formatHistoryList } from '../core/history-fetcher';
import { resolveToken } from '../core/token-resolver';
import { AppError, ERROR_CODES } from '../errors';
import { getSignerByImpl } from '../signer';

import type { BtcAddressType } from '../core/btc/address-types';
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
    .option('--address-type <type>', 'BTC address type for derived reads')
    .option('--limit <n>', 'Max records (default 20, max 50)', '20')
    .option('--detail', 'Include detail fields (block, nonce, confirmations)')
    .action(
      async (
        options: {
          chain: string;
          token?: string;
          address?: string;
          addressType?: BtcAddressType;
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
          const limit = Math.max(
            1,
            Math.min(50, parseInt(options.limit, 10) || 20),
          );
          const detail = options.detail ?? false;

          // Resolve wallet address
          let address = options.address;
          if (isBtcImpl(chainConfig.impl)) {
            if (address && options.addressType) {
              throw new AppError(
                ERROR_CODES.PARAM_INVALID_ADDRESS.code,
                '--address cannot be used with --address-type.',
                'Omit --address-type for external address reads, or omit --address to read derived wallet addresses.',
              );
            }

            if (options.token) {
              throw new AppError(
                ERROR_CODES.PARAM_INVALID_TOKEN.code,
                'Token filtering is not supported for BTC/TBTC history in this round.',
                'Omit --token to query native BTC/TBTC history.',
              );
            }

            if (!address) {
              const result = await fetchBtcDerivedHistory(chainConfig, {
                addressType: options.addressType,
                limit,
                detail,
              });
              output.success(result, {
                chain: options.chain,
                count: result.items.length,
              });
              return;
            }

            const result = await fetchBtcExternalAddressHistory(chainConfig, {
              addressInput: address,
              tokenAddress: undefined,
              limit,
              detail,
            });
            let items = result.items;
            if (detail) {
              items = items.map((item) => ({
                ...item,
                networkName: chainConfig.nativeSymbol,
              }));
            }
            output.success(items, {
              chain: options.chain,
              address: result.address,
              count: items.length,
              hasMore: result.response.hasMore ?? false,
            });
            return;
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
