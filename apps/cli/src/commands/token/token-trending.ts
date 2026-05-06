import { assertChainCapability, resolveChain } from '../../core/chain-resolver';
import { AppError, ERROR_CODES } from '../../errors';
import { apiClient } from '../../infra';

import type { OutputFormatter } from '../../output';
import type { Command } from 'commander';

/** Aligns with packages/shared/types/market.ts IMarketSearchV2Token */
interface ITrendingItem {
  name: string;
  price: string;
  symbol: string;
  address: string;
  network: string;
  logoUrl: string;
  isNative: boolean;
  decimals: number;
  marketCap?: string;
  priceChange24hPercent?: string;
  communityRecognized?: boolean;
}

function isValidTrendingItem(item: unknown): item is ITrendingItem {
  if (typeof item !== 'object' || item === null) return false;
  const r = item as Record<string, unknown>;
  return (
    typeof r.symbol === 'string' &&
    typeof r.address === 'string' &&
    typeof r.network === 'string' &&
    typeof r.decimals === 'number'
  );
}

export function registerTokenTrendingCommand(parent: Command): void {
  parent
    .command('trending')
    .description('List trending tokens')
    .option('--chain <chain>', 'Filter by chain (e.g., eth, base)')
    .option('--limit <n>', 'Max results', '20')
    .action(async (options: { chain?: string; limit: string }, command) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const globalOpts = command.optsWithGlobals() as Record<string, unknown>;
      const output = globalOpts._outputFormatter as OutputFormatter;

      try {
        let networkId: string | undefined;
        if (options.chain) {
          const chainConfig = resolveChain(options.chain);
          assertChainCapability(
            chainConfig,
            'evmTokenMarket',
            'token-trending',
          );
          networkId = chainConfig.networkId;
        }

        const limit = Math.max(
          1,
          Math.min(100, parseInt(options.limit, 10) || 20),
        );

        // Aligns with ServiceMarket.fetchTrendingV2()
        const rawResults = await apiClient.get<unknown>(
          'utility',
          '/utility/v2/market/trending',
        );

        // Runtime validation: API must return an array
        if (!Array.isArray(rawResults)) {
          throw new AppError(
            ERROR_CODES.NET_HTTP_ERROR.code,
            'Malformed trending response: expected array',
            'This may indicate an API contract change — check connectivity',
          );
        }

        const results = rawResults.filter(isValidTrendingItem);

        let filtered = networkId
          ? results.filter((t) => t.network === networkId)
          : results;

        filtered = filtered.slice(0, limit);

        const data = filtered.map((t) => ({
          symbol: t.symbol,
          name: t.name || null,
          contractAddress: t.address,
          networkId: t.network,
          price: t.price && t.price !== '--' ? t.price : null,
          priceChange24hPercent: t.priceChange24hPercent ?? null,
          marketCap: t.marketCap ?? null,
          logoUrl: t.logoUrl || null,
          isNative: t.isNative,
          communityRecognized: t.communityRecognized ?? false,
        }));

        const meta = options.chain ? { chain: options.chain } : {};
        output.success(data, meta);
      } catch (error) {
        const appError = AppError.from(error);
        output.error(appError.toErrorDetail());
        process.exitCode = appError.exitCode;
      }
    });
}
