import { resolveChain } from '../../core/chain-resolver';
import { AppError, ERROR_CODES } from '../../errors';
import { apiClient } from '../../infra';
import {
  amountToSmallestUnit,
  validateAmountDecimals,
} from '../../utils/tx-utils';

import type { OutputFormatter } from '../../output';
import type { Command } from 'commander';

interface IParseTransactionResponse {
  type?: string | null;
  display?: unknown;
  parsedTx?: unknown;
  accountAddress?: string;
  isConfirmationRequired?: boolean;
}

function isParseTransactionLike(
  value: unknown,
): value is IParseTransactionResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const result = value as Record<string, unknown>;
  return (
    'parsedTx' in result || 'accountAddress' in result || 'display' in result
  );
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
          const chainConfig = resolveChain(options.chain);

          // Validate --to is a valid EVM address
          if (!/^0x[0-9a-fA-F]{40}$/.test(options.to)) {
            throw new AppError(
              ERROR_CODES.PARAM_INVALID_ADDRESS.code,
              `Invalid --to address: "${options.to}"`,
              'Provide a valid EVM address (0x + 40 hex chars)',
            );
          }

          // Validate --data is hex with complete bytes (even number of hex chars)
          if (!/^0x(?:[0-9a-fA-F]{2})*$/.test(options.data)) {
            throw new AppError(
              ERROR_CODES.PARAM_MISSING_REQUIRED.code,
              `Invalid --data: must be hex-encoded calldata (0x + even number of hex chars)`,
              'Example: 0xa9059cbb000....',
            );
          }

          // Validate --from if provided
          if (options.from && !/^0x[0-9a-fA-F]{40}$/.test(options.from)) {
            throw new AppError(
              ERROR_CODES.PARAM_INVALID_ADDRESS.code,
              `Invalid --from address: "${options.from}"`,
              'Provide a valid EVM address (0x + 40 hex chars)',
            );
          }

          const encodedTx: Record<string, string> = {
            to: options.to,
            data: options.data,
          };
          if (options.value) {
            if (!/^\d+(\.\d+)?$/.test(options.value)) {
              throw new AppError(
                ERROR_CODES.PARAM_INVALID_AMOUNT.code,
                `Invalid value: "${options.value}"`,
                'Provide a valid amount (e.g., 0.1)',
              );
            }
            validateAmountDecimals(options.value, chainConfig.nativeDecimals);
            const wei = amountToSmallestUnit(
              options.value,
              chainConfig.nativeDecimals,
            );
            encodedTx.value = `0x${BigInt(wei).toString(16)}`;
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

          if (!isParseTransactionLike(result)) {
            throw new AppError(
              ERROR_CODES.NET_HTTP_ERROR.code,
              'Malformed parse-transaction response: missing required fields',
              'This may indicate an API contract change — check connectivity',
            );
          }

          output.success(
            {
              type: result.type ?? null,
              display: result.display ?? null,
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
