import { resolveChain } from '../../core/chain-resolver';
import { AppError, ERROR_CODES } from '../../errors';
import { apiClient } from '../../infra';

import type { OutputFormatter } from '../../output';
import type { Command } from 'commander';

interface IBatchTokenItem {
  address: string;
  name: string;
  symbol: string;
  decimals: number | string;
  price?: string;
  priceChange24hPercent?: string;
  networkId?: string;
  isNative?: boolean;
}

interface IBatchListResponse {
  list: IBatchTokenItem[];
}

function isValidBatchItem(v: unknown): v is IBatchTokenItem {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return typeof r.symbol === 'string' && typeof r.address === 'string';
}

function parseTokenList(
  input: string,
): Array<{ chainId: string; contractAddress: string; isNative: boolean }> {
  return input.split(',').map((entry) => {
    const trimmed = entry.trim();
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) {
      throw new AppError(
        ERROR_CODES.PARAM_INVALID_CHAIN.code,
        `Invalid token format: "${trimmed}" — expected "chain:address"`,
        `Example: eth:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48`,
      );
    }
    const chain = trimmed.slice(0, colonIdx);
    const address = trimmed.slice(colonIdx + 1);

    const chainConfig = resolveChain(chain);

    const isNative = !address || address === 'native';
    return {
      chainId: chainConfig.networkId,
      contractAddress: isNative ? '' : address,
      isNative,
    };
  });
}

export function registerMarketPricesCommand(parent: Command): void {
  parent
    .command('prices')
    .description('Get batch token prices in a single request')
    .requiredOption(
      '--tokens <tokens>',
      'Comma-separated list of chain:address pairs (e.g., eth:0xa0b8...,base:0x8335...)',
    )
    .action(async (options: { tokens: string }, command) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const globalOpts = command.optsWithGlobals() as Record<string, unknown>;
      const output = globalOpts._outputFormatter as OutputFormatter;

      try {
        const tokenAddressList = parseTokenList(options.tokens);

        if (tokenAddressList.length === 0) {
          throw new AppError(
            ERROR_CODES.PARAM_INVALID_CHAIN.code,
            'No tokens specified in --tokens',
            'Provide at least one token in chain:address format',
          );
        }

        const result = await apiClient.post<IBatchListResponse>(
          'utility',
          '/utility/v2/market/token/list/batch',
          {
            tokenAddressList,
            currency: 'usd',
          },
          { 'x-onekey-request-currency': 'usd' },
        );

        if (
          typeof result !== 'object' ||
          result === null ||
          !('list' in result)
        ) {
          throw new AppError(
            ERROR_CODES.NET_HTTP_ERROR.code,
            'Malformed batch response: missing list envelope',
            'This may indicate an API contract change — check connectivity',
          );
        }

        if (!Array.isArray(result.list)) {
          throw new AppError(
            ERROR_CODES.NET_HTTP_ERROR.code,
            'Malformed batch response: list is not an array',
            'This may indicate an API contract change — check connectivity',
          );
        }

        if (result.list.length !== tokenAddressList.length) {
          throw new AppError(
            ERROR_CODES.NET_HTTP_ERROR.code,
            `Batch response length mismatch: requested ${tokenAddressList.length} tokens but got ${result.list.length}`,
            'API may have dropped or duplicated tokens — check parameters',
          );
        }

        const data = result.list.map((item, index) => {
          if (!isValidBatchItem(item)) {
            throw new AppError(
              ERROR_CODES.NET_HTTP_ERROR.code,
              `Malformed batch item at index ${index}: missing required fields`,
              'This may indicate an API contract change — check connectivity',
            );
          }

          const req = tokenAddressList[index];
          const returnedNetwork = item.networkId ?? '';
          if (returnedNetwork && returnedNetwork !== req.chainId) {
            throw new AppError(
              ERROR_CODES.NET_HTTP_ERROR.code,
              `Batch item ${index} network mismatch: requested ${req.chainId} but got ${returnedNetwork}`,
              'API may have returned data for a different token',
            );
          }
          if (req.isNative && item.isNative !== true) {
            throw new AppError(
              ERROR_CODES.NET_HTTP_ERROR.code,
              `Batch item ${index}: expected native token but API did not confirm isNative=true`,
              'API may have returned data for a different token',
            );
          }
          if (
            !req.isNative &&
            item.address.toLowerCase() !== req.contractAddress.toLowerCase()
          ) {
            throw new AppError(
              ERROR_CODES.NET_HTTP_ERROR.code,
              `Batch item ${index} address mismatch: requested ${req.contractAddress} but got ${item.address}`,
              'API may have returned data for a different token',
            );
          }

          return {
            symbol: item.symbol,
            contractAddress: item.address,
            networkId: item.networkId ?? req.chainId,
            price: item.price ?? null,
            priceChange24hPercent: item.priceChange24hPercent ?? null,
          };
        });

        output.success(data);
      } catch (error) {
        const appError = AppError.from(error);
        output.error(appError.toErrorDetail());
        process.exitCode = appError.exitCode;
      }
    });
}
