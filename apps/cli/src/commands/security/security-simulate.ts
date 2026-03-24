import { CHAINS } from '../../config';
import { AppError, ERROR_CODES } from '../../errors';
import { apiClient } from '../../infra';

import type { OutputFormatter } from '../../output';
import type { Command } from 'commander';

interface IParseTransactionResponse {
  type?: string;
  display?: unknown;
  parsedTx?: unknown;
  accountAddress?: string;
  isConfirmationRequired?: boolean;
}

export function registerSecuritySimulateCommand(parent: Command): void {
  parent
    .command('simulate')
    .description('Simulate a transaction before signing')
    .requiredOption('--chain <chain>', 'Target blockchain (e.g., eth, base)')
    .requiredOption('--to <address>', 'Target contract address')
    .requiredOption('--data <hex>', 'Transaction calldata (hex)')
    .option('--value <amount>', 'ETH value to send (in ether)')
    .option('--from <address>', 'Sender address')
    .action(
      async (
        options: {
          chain: string;
          to: string;
          data: string;
          value?: string;
          from?: string;
        },
        command,
      ) => {
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

          const encodedTx: Record<string, string> = {
            to: options.to,
            data: options.data,
          };
          if (options.value) {
            const parsed = parseFloat(options.value);
            if (Number.isNaN(parsed) || parsed < 0) {
              throw new AppError(
                ERROR_CODES.PARAM_INVALID_AMOUNT.code,
                `Invalid value: "${options.value}"`,
                'Provide a valid ETH amount (e.g., 0.1)',
              );
            }
            encodedTx.value = `0x${BigInt(Math.floor(parsed * 1e18)).toString(16)}`;
          }

          // accountAddress is required by the API — use --from or a zero address
          const accountAddress =
            options.from || '0x0000000000000000000000000000000000000001';

          const result = await apiClient.post<IParseTransactionResponse>(
            'wallet',
            '/wallet/v1/account/parse-transaction',
            {
              networkId: chainConfig.networkId,
              accountAddress,
              encodedTx,
            },
          );

          if (
            typeof result !== 'object' ||
            result === null ||
            !('display' in result)
          ) {
            throw new AppError(
              ERROR_CODES.NET_HTTP_ERROR.code,
              'Malformed parse-transaction response: missing display field',
              'This may indicate an API contract change — check connectivity',
            );
          }

          output.success(
            {
              type: result.type ?? null,
              display: result.display,
              parsedTx: result.parsedTx ?? null,
              accountAddress: result.accountAddress ?? accountAddress,
              isConfirmationRequired: result.isConfirmationRequired ?? false,
            },
            { chain: options.chain },
          );
        } catch (error) {
          const appError = AppError.from(error);
          output.error(appError.toErrorDetail());
          process.exitCode = appError.exitCode;
        }
      },
    );
}
