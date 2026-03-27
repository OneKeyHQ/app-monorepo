import { resolveToken } from '../../core';
import { resolveChain } from '../../core/chain-resolver';
import { AppError, ERROR_CODES } from '../../errors';
import { apiClient } from '../../infra';

import type { OutputFormatter } from '../../output';
import type { Command } from 'commander';

interface ITokenDetailPayload {
  symbol: string;
  address: string;
  networkId?: string;
  isNative?: boolean;
  trade1mCount?: string;
  trade5mCount?: string;
  trade1hCount?: string;
  trade4hCount?: string;
  trade24hCount?: string;
  buy1mCount?: string;
  buy5mCount?: string;
  buy1hCount?: string;
  buy4hCount?: string;
  buy24hCount?: string;
  sell1mCount?: string;
  sell5mCount?: string;
  sell1hCount?: string;
  sell4hCount?: string;
  sell24hCount?: string;
  volume1m?: string;
  volume5m?: string;
  volume1h?: string;
  volume4h?: string;
  volume24h?: string;
  vBuy1m?: string;
  vBuy5m?: string;
  vBuy1h?: string;
  vBuy4h?: string;
  vBuy24h?: string;
  vSell1m?: string;
  vSell5m?: string;
  vSell1h?: string;
  vSell4h?: string;
  vSell24h?: string;
  uniqueWallet1m?: string;
  uniqueWallet5m?: string;
  uniqueWallet1h?: string;
  uniqueWallet4h?: string;
  uniqueWallet24h?: string;
}

interface ITokenDetailResponse {
  token: ITokenDetailPayload;
}

const STAT_FIELDS: readonly (keyof ITokenDetailPayload)[] = [
  'trade1mCount',
  'trade5mCount',
  'trade1hCount',
  'trade4hCount',
  'trade24hCount',
  'buy1mCount',
  'buy5mCount',
  'buy1hCount',
  'buy4hCount',
  'buy24hCount',
  'sell1mCount',
  'sell5mCount',
  'sell1hCount',
  'sell4hCount',
  'sell24hCount',
  'volume1m',
  'volume5m',
  'volume1h',
  'volume4h',
  'volume24h',
  'vBuy1m',
  'vBuy5m',
  'vBuy1h',
  'vBuy4h',
  'vBuy24h',
  'vSell1m',
  'vSell5m',
  'vSell1h',
  'vSell4h',
  'vSell24h',
  'uniqueWallet1m',
  'uniqueWallet5m',
  'uniqueWallet1h',
  'uniqueWallet4h',
  'uniqueWallet24h',
];

function isValidTokenDetail(v: unknown): v is ITokenDetailPayload {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  if (typeof r.symbol !== 'string' || typeof r.address !== 'string') {
    return false;
  }
  for (const key of STAT_FIELDS) {
    const val = r[key];
    if (val !== undefined && val !== null && typeof val !== 'string') {
      return false;
    }
  }
  return true;
}

function buildTimeframeStat(
  t: ITokenDetailPayload,
  suffix: '1m' | '5m' | '1h' | '4h' | '24h',
) {
  const tradeKey = `trade${suffix}Count` as keyof ITokenDetailPayload;
  const buyKey = `buy${suffix}Count` as keyof ITokenDetailPayload;
  const sellKey = `sell${suffix}Count` as keyof ITokenDetailPayload;
  const volumeKey = `volume${suffix}` as keyof ITokenDetailPayload;
  const vBuyKey = `vBuy${suffix}` as keyof ITokenDetailPayload;
  const vSellKey = `vSell${suffix}` as keyof ITokenDetailPayload;
  const walletKey = `uniqueWallet${suffix}` as keyof ITokenDetailPayload;

  return {
    trades: t[tradeKey] ?? null,
    buys: t[buyKey] ?? null,
    sells: t[sellKey] ?? null,
    volume: t[volumeKey] ?? null,
    vBuy: t[vBuyKey] ?? null,
    vSell: t[vSellKey] ?? null,
    uniqueWallets: t[walletKey] ?? null,
  };
}

export function registerTokenTradesCommand(parent: Command): void {
  parent
    .command('trades')
    .description('Get token trade statistics across multiple timeframes')
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
            'Malformed token detail response: missing required fields or invalid stat field types',
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

        const timeframes = ['1m', '5m', '1h', '4h', '24h'] as const;
        const stats: Record<string, ReturnType<typeof buildTimeframeStat>> = {};
        for (const tf of timeframes) {
          stats[tf] = buildTimeframeStat(t, tf);
        }

        output.success(
          {
            symbol: t.symbol ?? resolved.symbol,
            contractAddress: t.address ?? resolved.contractAddress,
            networkId: resolved.networkId,
            stats,
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
