import { resolveChain } from '../../core/chain-resolver';
import { AppError, ERROR_CODES } from '../../errors';
import { apiClient } from '../../infra';

import type { OutputFormatter } from '../../output';
import type { Command } from 'commander';

/** Aligns with packages/shared/types/market.ts IMarketSearchV2Token */
interface IMarketSearchItem {
  name: string;
  price: string;
  symbol: string;
  address: string;
  network: string;
  logoUrl: string;
  isNative: boolean;
  decimals: number;
  liquidity: string;
  volume24h?: string;
  volume_24h?: string;
  marketCap?: string;
  priceChange24hPercent?: string;
  communityRecognized?: boolean;
}

function isValidSearchItem(item: unknown): item is IMarketSearchItem {
  if (typeof item !== 'object' || item === null) return false;
  const r = item as Record<string, unknown>;
  return (
    typeof r.symbol === 'string' &&
    typeof r.address === 'string' &&
    typeof r.network === 'string' &&
    typeof r.decimals === 'number'
  );
}

export function registerTokenSearchCommand(parent: Command): void {
  parent
    .command('search')
    .description('Search tokens by keyword (symbol, name, or contract address)')
    .requiredOption('--query <keyword>', 'Search keyword')
    .option('--chain <chain>', 'Filter by chain (e.g., eth, base, bsc)')
    .option('--limit <n>', 'Max results to return', '10')
    .action(
      async (
        options: { query: string; chain?: string; limit: string },
        command,
      ) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        const globalOpts = command.optsWithGlobals() as Record<string, unknown>;
        const output = globalOpts._outputFormatter as OutputFormatter;

        try {
          // Validate --chain if provided
          let networkId: string | undefined;
          if (options.chain) {
            const chainConfig = resolveChain(options.chain);
            networkId = chainConfig.networkId;
          }

          const limit = Math.max(
            1,
            Math.min(100, parseInt(options.limit, 10) || 10),
          );
          const meta = options.chain ? { chain: options.chain } : {};

          // Call V2 market search — aligns with ServiceMarket.searchV2Token()
          const rawResults = await apiClient.get<unknown>(
            'utility',
            '/utility/v2/market/search',
            { query: options.query },
          );

          // Runtime validation: API must return an array
          if (!Array.isArray(rawResults)) {
            throw new AppError(
              ERROR_CODES.NET_HTTP_ERROR.code,
              'Malformed search response: expected array',
              'This may indicate an API contract change — check connectivity',
            );
          }

          const results = rawResults.filter(isValidSearchItem);

          // Filter by chain if specified
          let filtered = networkId
            ? results.filter((t) => t.network === networkId)
            : results;

          // Apply limit
          filtered = filtered.slice(0, limit);

          // Map to output format
          const data = filtered.map((t) => ({
            contractAddress: t.address,
            symbol: t.symbol,
            name: t.name || null,
            decimals: t.decimals,
            price: t.price && t.price !== '--' ? t.price : null,
            networkId: t.network,
            logoUrl: t.logoUrl || null,
            isNative: t.isNative,
            liquidity: t.liquidity || null,
            marketCap: t.marketCap ?? null,
            communityRecognized: t.communityRecognized ?? false,
          }));

          output.success(data, meta);
        } catch (error) {
          const appError = AppError.from(error);
          output.error(appError.toErrorDetail());
          process.exitCode = appError.exitCode;
        }
      },
    );
}
