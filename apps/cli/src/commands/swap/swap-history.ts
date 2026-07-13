import { listPending } from '../../core';
import { resolveChain } from '../../core/chain-resolver';
import { AppError } from '../../errors';
import { requireAuthenticatedCommand } from '../command-guards';

import type { OutputFormatter } from '../../output';
import type { Command } from 'commander';

export function registerSwapHistoryCommand(parent: Command): void {
  parent
    .command('history')
    .description('List swap transaction history')
    .option('--chain <chain>', 'Filter by chain')
    .option('--limit <n>', 'Max records', '20')
    .action(async (options: { chain?: string; limit: string }, command) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const globalOpts = command.optsWithGlobals() as Record<string, unknown>;
      const output = globalOpts._outputFormatter as OutputFormatter;

      try {
        await requireAuthenticatedCommand();

        if (options.chain) {
          resolveChain(options.chain);
        }

        const limit = Math.max(
          1,
          Math.min(100, parseInt(options.limit, 10) || 20),
        );

        const orders = listPending({
          chain: options.chain,
          limit,
        });

        const data = orders.map((o) => ({
          orderId: o.orderId,
          status: o.status,
          chain: o.chain,
          from: o.fromToken?.symbol ?? null,
          to: o.toToken?.symbol ?? null,
          amount: o.amount,
          txHash: o.txHash ?? null,
          provider: o.provider ?? null,
          createdAt: o.createdAt,
          updatedAt: o.updatedAt,
        }));

        output.success(
          data,
          options.chain ? { chain: options.chain } : undefined,
        );
      } catch (error) {
        const appError = AppError.from(error);
        output.error(appError.toErrorDetail());
        process.exitCode = appError.exitCode;
      }
    });
}
