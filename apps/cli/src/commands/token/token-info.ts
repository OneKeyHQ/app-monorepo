import { resolveToken } from '../../core';
import { resolveChain } from '../../core/chain-resolver';
import { AppError, ERROR_CODES } from '../../errors';
import { apiClient } from '../../infra';

import type { OutputFormatter } from '../../output';
import type { Command } from 'commander';

/** Aligns with packages/shared/types/marketV2.ts IMarketTokenDetail */
interface ITokenDetailPayload {
  isNative?: boolean;
  networkId?: string;
  address: string;
  logoUrl: string;
  name: string;
  symbol: string;
  decimals: number;
  marketCap?: string;
  fdv?: string;
  tvl?: string;
  liquidity?: string;
  holders?: number;
  circulatingSupply?: string;
  price?: string;
  priceChange1hPercent?: string;
  priceChange4hPercent?: string;
  priceChange24hPercent?: string;
  extraData?: { website?: string; twitter?: string };
  supportSwap?: { enable: boolean };
  communityRecognized?: boolean;
}

interface ITokenDetailResponse {
  token: ITokenDetailPayload;
  websocket?: { txs: boolean; kline: boolean };
}

function isValidTokenDetail(v: unknown): v is ITokenDetailPayload {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.symbol === 'string' &&
    typeof r.name === 'string' &&
    typeof r.decimals === 'number' &&
    typeof r.address === 'string'
  );
}

export function registerTokenInfoCommand(parent: Command): void {
  parent
    .command('info')
    .description('Get detailed information about a token')
    .requiredOption('--chain <chain>', 'Target blockchain (e.g., eth, base)')
    .requiredOption('--token <token>', 'Token contract address or symbol')
    .action(async (options: { chain: string; token: string }, command) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const globalOpts = command.optsWithGlobals() as Record<string, unknown>;
      const output = globalOpts._outputFormatter as OutputFormatter;

      try {
        resolveChain(options.chain);

        // Step 1: Resolve token → get contractAddress + networkId
        const resolved = await resolveToken(options.token, options.chain);

        // Step 2: Fetch detailed info from V2 API
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

        if (t.networkId && t.networkId !== resolved.networkId) {
          throw new AppError(
            ERROR_CODES.NET_HTTP_ERROR.code,
            `Network mismatch: requested ${resolved.networkId} but got ${t.networkId}`,
            'API may have returned data for a different network',
          );
        }

        if (resolved.isNative && t.isNative === false) {
          throw new AppError(
            ERROR_CODES.NET_HTTP_ERROR.code,
            'Expected native token but API returned a non-native token',
            'API may have returned data for a different token',
          );
        }

        output.success(
          {
            // Basics
            name: t.name,
            symbol: t.symbol,
            decimals: t.decimals,
            contractAddress: t.address,
            networkId: resolved.networkId,
            isNative: t.isNative ?? resolved.isNative,
            logoUrl: t.logoUrl ?? null,
            // Market
            price: t.price ?? null,
            marketCap: t.marketCap ?? null,
            fdv: t.fdv ?? null,
            tvl: t.tvl ?? null,
            liquidity: t.liquidity ?? null,
            circulatingSupply: t.circulatingSupply ?? null,
            holders: t.holders ?? null,
            // Price changes
            priceChange1hPercent: t.priceChange1hPercent ?? null,
            priceChange4hPercent: t.priceChange4hPercent ?? null,
            priceChange24hPercent: t.priceChange24hPercent ?? null,
            // Extended
            extraData: t.extraData ?? null,
            supportSwap: t.supportSwap ?? null,
            communityRecognized: t.communityRecognized ?? false,
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
