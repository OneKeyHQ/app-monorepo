import { resolveToken } from '../../core';
import { assertChainCapability, resolveChain } from '../../core/chain-resolver';
import { AppError, ERROR_CODES } from '../../errors';
import { apiClient } from '../../infra';

import type { OutputFormatter } from '../../output';
import type { Command } from 'commander';

interface ITopHolderItem {
  accountAddress: string;
  amount: string;
  fiatValue: string;
  percentage?: string;
}

interface ITopHoldersResponse {
  list: ITopHolderItem[];
}

function isValidHolderItem(v: unknown): v is ITopHolderItem {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.accountAddress === 'string' &&
    typeof r.amount === 'string' &&
    typeof r.fiatValue === 'string' &&
    (r.percentage === undefined ||
      r.percentage === null ||
      typeof r.percentage === 'string')
  );
}

export function registerTokenLiquidityCommand(parent: Command): void {
  parent
    .command('liquidity')
    .description('Get top token holders')
    .requiredOption('--chain <chain>', 'Target blockchain (e.g., eth, base)')
    .requiredOption('--token <token>', 'Token contract address or symbol')
    .action(async (options: { chain: string; token: string }, command) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const globalOpts = command.optsWithGlobals() as Record<string, unknown>;
      const output = globalOpts._outputFormatter as OutputFormatter;

      try {
        const chainConfig = resolveChain(options.chain);
        assertChainCapability(chainConfig, 'evmTokenMarket', 'token-liquidity');

        const resolved = await resolveToken(options.token, options.chain);

        const result = await apiClient.get<ITopHoldersResponse>(
          'utility',
          '/utility/v2/market/token/top-holders',
          {
            tokenAddress: resolved.contractAddress,
            networkId: resolved.networkId,
            currency: 'usd',
          },
        );

        if (
          typeof result !== 'object' ||
          result === null ||
          !('list' in result)
        ) {
          throw new AppError(
            ERROR_CODES.NET_HTTP_ERROR.code,
            'Malformed top-holders response: missing list envelope',
            'This may indicate an API contract change — check connectivity',
          );
        }

        const { list } = result;

        if (!Array.isArray(list)) {
          throw new AppError(
            ERROR_CODES.NET_HTTP_ERROR.code,
            'Malformed top-holders response: list is not an array',
            'This may indicate an API contract change — check connectivity',
          );
        }

        const data = list
          .filter((item) => isValidHolderItem(item))
          .map((h) => ({
            accountAddress: h.accountAddress,
            amount: h.amount,
            fiatValue: h.fiatValue,
            percentage: h.percentage ?? null,
          }));

        output.success(data, { chain: options.chain });
      } catch (error) {
        const appError = AppError.from(error);
        output.error(appError.toErrorDetail());
        process.exitCode = appError.exitCode;
      }
    });
}
