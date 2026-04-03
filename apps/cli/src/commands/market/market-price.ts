import { resolveToken } from '../../core';
import { resolveChain } from '../../core/chain-resolver';
import { AppError, ERROR_CODES } from '../../errors';
import { apiClient } from '../../infra';

import type { OutputFormatter } from '../../output';
import type { Command } from 'commander';

interface ITokenDetailPayload {
  symbol: string;
  address: string;
  isNative?: boolean;
  price?: string;
  priceChange1mPercent?: string;
  priceChange5mPercent?: string;
  priceChange1hPercent?: string;
  priceChange4hPercent?: string;
  priceChange24hPercent?: string;
}

interface ITokenDetailResponse {
  token: ITokenDetailPayload;
}

function isValidTokenDetail(v: unknown): v is ITokenDetailPayload {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return typeof r.symbol === 'string' && typeof r.address === 'string';
}

export function registerMarketPriceCommand(parent: Command): void {
  parent
    .command('price')
    .description('Get single token price from market data')
    .requiredOption('--chain <chain>', 'Target blockchain (e.g., eth, base)')
    .requiredOption('--token <token>', 'Token contract address or symbol')
    .action(async (options: { chain: string; token: string }, command) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const globalOpts = command.optsWithGlobals() as Record<string, unknown>;
      const output = globalOpts._outputFormatter as OutputFormatter;

      try {
        resolveChain(options.chain);

        const resolved = await resolveToken(options.token, options.chain);

        const detail = await apiClient.get<ITokenDetailResponse>(
          'utility',
          '/utility/v2/market/token/detail',
          {
            tokenAddress: resolved.contractAddress,
            networkId: resolved.networkId,
            currency: 'usd',
          },
        );

        if (
          typeof detail !== 'object' ||
          detail === null ||
          !('token' in detail)
        ) {
          throw new AppError(
            ERROR_CODES.NET_HTTP_ERROR.code,
            'Malformed token detail response: missing token envelope',
            'This may indicate an API contract change — check connectivity',
          );
        }

        const t = detail.token;

        if (!isValidTokenDetail(t)) {
          throw new AppError(
            ERROR_CODES.NET_HTTP_ERROR.code,
            'Malformed token detail response: missing required fields',
            'This may indicate an API contract change — check connectivity',
          );
        }

        if (
          resolved.contractAddress &&
          t.address.toLowerCase() !== resolved.contractAddress.toLowerCase()
        ) {
          throw new AppError(
            ERROR_CODES.NET_HTTP_ERROR.code,
            `Token address mismatch: requested ${resolved.contractAddress} but got ${t.address}`,
            'API may have returned data for a different token',
          );
        }

        if (resolved.isNative && t.isNative === false) {
          throw new AppError(
            ERROR_CODES.NET_HTTP_ERROR.code,
            'Expected native token but API did not confirm isNative=true',
            'API may have returned data for a different token',
          );
        }

        output.success(
          {
            symbol: t.symbol ?? resolved.symbol,
            contractAddress: t.address ?? resolved.contractAddress,
            networkId: resolved.networkId,
            price: t.price ?? null,
            priceChange1mPercent: t.priceChange1mPercent ?? null,
            priceChange5mPercent: t.priceChange5mPercent ?? null,
            priceChange1hPercent: t.priceChange1hPercent ?? null,
            priceChange4hPercent: t.priceChange4hPercent ?? null,
            priceChange24hPercent: t.priceChange24hPercent ?? null,
          },
          { chain: options.chain },
        );
      } catch (error) {
        const appError = AppError.from(error);
        output.error(appError.toErrorDetail());
        process.exitCode = appError.exitCode;
      }
    });
}
