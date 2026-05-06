import { resolveToken } from '../../core';
import { assertChainCapability, resolveChain } from '../../core/chain-resolver';
import { AppError, ERROR_CODES } from '../../errors';
import { apiClient } from '../../infra';

import type { OutputFormatter } from '../../output';
import type { Command } from 'commander';

interface IKLinePoint {
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  t: number;
}

interface IKLineResponse {
  points: IKLinePoint[];
  total: number;
}

const INTERVAL_SECONDS: Record<string, number> = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '30m': 1800,
  '1H': 3600,
  '4H': 14_400,
  '1D': 86_400,
  '1W': 604_800,
};

function isValidKLinePoint(v: unknown): v is IKLinePoint {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.o === 'number' &&
    typeof r.h === 'number' &&
    typeof r.l === 'number' &&
    typeof r.c === 'number' &&
    typeof r.v === 'number' &&
    typeof r.t === 'number'
  );
}

// Align with App's ServiceMarketV2.fetchMarketTokenKLine() interval conversion:
// Minutes/seconds → lowercase, hours/days/weeks → uppercase
function normalizeInterval(input: string): string {
  const upper = input.toUpperCase();
  if (upper.includes('M') || upper.includes('S')) {
    return upper.toLowerCase();
  }
  return upper;
}

export function registerMarketKlineCommand(parent: Command): void {
  parent
    .command('kline')
    .description('Get token OHLCV kline data')
    .requiredOption('--chain <chain>', 'Target blockchain (e.g., eth, base)')
    .requiredOption('--token <token>', 'Token contract address or symbol')
    .option(
      '--interval <interval>',
      'Kline interval: 1m,5m,15m,30m,1H,4H,1D,1W',
      '1H',
    )
    .option('--limit <n>', 'Number of data points', '24')
    .action(
      async (
        options: {
          chain: string;
          token: string;
          interval: string;
          limit: string;
        },
        command,
      ) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        const globalOpts = command.optsWithGlobals() as Record<string, unknown>;
        const output = globalOpts._outputFormatter as OutputFormatter;

        try {
          const chainConfig = resolveChain(options.chain);
          assertChainCapability(chainConfig, 'evmTokenMarket', 'market-kline');

          const interval = normalizeInterval(options.interval);
          const intervalSeconds = INTERVAL_SECONDS[interval];
          if (!intervalSeconds) {
            throw new AppError(
              ERROR_CODES.PARAM_MISSING_REQUIRED.code,
              `Invalid interval: "${options.interval}"`,
              `Valid intervals: ${Object.keys(INTERVAL_SECONDS).join(', ')}`,
            );
          }

          const limit = Math.max(
            1,
            Math.min(500, parseInt(options.limit, 10) || 24),
          );

          const resolved = await resolveToken(options.token, options.chain);

          const timeTo = Math.floor(Date.now() / 1000);
          const timeFrom = timeTo - intervalSeconds * limit;

          const result = await apiClient.get<IKLineResponse>(
            'utility',
            '/utility/v2/market/token/kline',
            {
              tokenAddress: resolved.contractAddress,
              networkId: resolved.networkId,
              interval,
              timeFrom,
              timeTo,
              currency: 'usd',
            },
          );

          if (
            typeof result !== 'object' ||
            result === null ||
            !('points' in result)
          ) {
            throw new AppError(
              ERROR_CODES.NET_HTTP_ERROR.code,
              'Malformed kline response: missing points envelope',
              'This may indicate an API contract change — check connectivity',
            );
          }

          if (!Array.isArray(result.points)) {
            throw new AppError(
              ERROR_CODES.NET_HTTP_ERROR.code,
              'Malformed kline response: points is not an array',
              'This may indicate an API contract change — check connectivity',
            );
          }

          for (let i = 0; i < result.points.length; i += 1) {
            if (!isValidKLinePoint(result.points[i])) {
              throw new AppError(
                ERROR_CODES.NET_HTTP_ERROR.code,
                `Malformed kline point at index ${i}: missing OHLCV fields`,
                'This may indicate an API contract change — check connectivity',
              );
            }
          }

          output.success(result.points, { chain: options.chain });
        } catch (error) {
          const appError = AppError.from(error);
          output.error(appError.toErrorDetail());
          process.exitCode = appError.exitCode;
        }
      },
    );
}
