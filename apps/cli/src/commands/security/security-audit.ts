import { auditToken, resolveToken } from '../../core';
import { resolveChain } from '../../core/chain-resolver';
import { AppError, ERROR_CODES } from '../../errors';

import type { IAuditSummary } from '../../core';
import type { OutputFormatter } from '../../output';
import type { Command } from 'commander';

function computeOverallRisk(audit: IAuditSummary): 'high' | 'caution' | 'low' {
  if (audit.isHighRisk) return 'high';
  if (audit.cautionItems.length > 0) return 'caution';
  return 'low';
}

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
        const chainConfig = resolveChain(options.chain);

        const resolved = await resolveToken(options.token, options.chain);

        if (resolved.isNative || !resolved.contractAddress) {
          throw new AppError(
            ERROR_CODES.PARAM_INVALID_TOKEN.code,
            `Security audit is not available for native tokens (${resolved.symbol})`,
            'Provide an ERC-20 token contract address or symbol',
          );
        }

        const audit = await auditToken(
          chainConfig.networkId,
          resolved.contractAddress,
        );

        output.success(
          {
            symbol: resolved.symbol,
            contractAddress: resolved.contractAddress,
            networkId: resolved.networkId,
            overallRisk: computeOverallRisk(audit),
            riskItems: audit.riskItems,
            cautionItems: audit.cautionItems,
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
