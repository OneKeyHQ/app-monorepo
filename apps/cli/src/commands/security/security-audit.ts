import { CHAINS } from '../../config';
import { auditToken, resolveToken } from '../../core';
import { AppError, ERROR_CODES } from '../../errors';

import type { OutputFormatter } from '../../output';
import type { Command } from 'commander';

export function registerSecurityAuditCommand(parent: Command): void {
  parent
    .command('audit')
    .description('Run security audit on a token')
    .requiredOption('--chain <chain>', 'Target blockchain (e.g., eth, base)')
    .requiredOption('--token <token>', 'Token contract address or symbol')
    .action(async (options: { chain: string; token: string }, command) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const globalOpts = command.optsWithGlobals() as Record<string, unknown>;
      const output = globalOpts._outputFormatter as OutputFormatter;

      try {
        const chainConfig = CHAINS[options.chain];
        if (!chainConfig) {
          throw new AppError(
            ERROR_CODES.PARAM_INVALID_CHAIN.code,
            `Unsupported chain: "${options.chain}"`,
            `Valid chains: ${Object.keys(CHAINS).join(', ')}`,
          );
        }

        const resolved = await resolveToken(options.token, options.chain);
        const audit = await auditToken(
          chainConfig.networkId,
          resolved.contractAddress,
        );

        output.success(
          {
            symbol: resolved.symbol,
            contractAddress: resolved.contractAddress,
            networkId: resolved.networkId,
            overallRisk: audit.isHighRisk ? 'high' : 'low',
            riskItems: audit.riskItems,
            checks: audit.data,
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
