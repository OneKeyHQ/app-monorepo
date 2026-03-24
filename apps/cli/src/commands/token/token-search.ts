import { CHAINS } from '../../config';
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
            const chainConfig = CHAINS[options.chain];
            if (!chainConfig) {
              throw new AppError(
                ERROR_CODES.PARAM_INVALID_CHAIN.code,
                `Unsupported chain: "${options.chain}"`,
                `Valid chains: ${Object.keys(CHAINS).join(', ')}`,
              );
            }
            networkId = chainConfig.networkId;
          }

          const limit = Math.max(
            1,
            Math.min(100, parseInt(options.limit, 10) || 10),
          );

          // Call V2 market search — aligns with ServiceMarket.searchV2Token()
          const results = await apiClient.get<IMarketSearchItem[]>(
            'utility',
            '/utility/v2/market/search',
            { query: options.query },
          );

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

          const meta = options.chain ? { chain: options.chain } : {};
          output.success(data, meta);
        } catch (error) {
          const appError = AppError.from(error);
          output.error(appError.toErrorDetail());
          process.exitCode = appError.exitCode;
        }
      },
    );
}
