import { loadPending, updatePendingStatus } from '../../core';
import { resolveChain } from '../../core/chain-resolver';
import { AppError, ERROR_CODES } from '../../errors';
import { apiClient } from '../../infra';

import type { IEndpointEnv } from '../../config';
import type { OutputFormatter } from '../../output';
import type { Command } from 'commander';

interface IStateTxResponse {
  state: string;
  dealReceiveAmount?: string;
  gasFee?: string;
  gasFeeFiatValue?: string;
  crossChainReceiveTxHash?: string;
  timestamp?: number;
  blockNumber?: number;
  txId?: string;
}

// Map API state to local pending order status
function mapStateToOrderStatus(
  apiState: string,
): 'pending' | 'executed' | 'failed' {
  switch (apiState) {
    case 'success':
      return 'executed';
    case 'failed':
    case 'canceled':
      return 'failed';
    default:
      return 'pending';
  }
}

export function registerSwapStatusCommand(parent: Command): void {
  parent
    .command('status')
    .description('Query swap transaction status')
    .requiredOption('--chain <chain>', 'Target blockchain (e.g., eth, base)')
    .option('--order <orderId>', 'Order ID from swap build output')
    .option('--tx <txHash>', 'Transaction hash to query')
    .action(
      async (
        options: {
          chain: string;
          order?: string;
          tx?: string;
        },
        command,
      ) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        const globalOpts = command.optsWithGlobals() as Record<string, unknown>;
        const output = globalOpts._outputFormatter as OutputFormatter;

        try {
          // Validate: at least one of --order or --tx is required
          if (!options.order && !options.tx) {
            throw new AppError(
              ERROR_CODES.PARAM_MISSING_REQUIRED.code,
              'Either --order or --tx is required',
              'Usage: onekey swap status --chain eth --order <orderId> or --tx <txHash>',
            );
          }

          // Validate chain
          const chainConfig = resolveChain(options.chain);

          // Resolve env
          const env = (
            (globalOpts.env as string) === 'prod' ? 'prod' : 'test'
          ) as IEndpointEnv;
          apiClient.setEnv(env);

          let txHash: string | undefined;
          let provider: string | undefined;
          let toTokenAddress: string | undefined;
          let orderId: string | undefined;
          let orderStatus: string | undefined;
          let receivedAddress: string | undefined;
          let buildTxCtx: unknown;

          if (options.order) {
            // Load order without expiry check — status queries should work for old orders
            const order = loadPending(options.order, { skipExpiry: true });

            // Verify chain matches
            if (order.chain !== options.chain) {
              throw new AppError(
                ERROR_CODES.PARAM_INVALID_CHAIN.code,
                `Order chain "${order.chain}" does not match --chain "${options.chain}"`,
                `Use --chain ${order.chain}`,
              );
            }

            txHash = order.txHash;
            provider = order.provider;
            toTokenAddress = order.toToken.contractAddress;
            orderStatus = order.status;

            // Use the build-tx API's orderId (provider-specific), NOT our local UUID.
            // The state-tx API needs the provider's orderId to look up swap status.
            const txDataObj = order.txData;
            orderId = (txDataObj.orderId as string) ?? undefined;
            buildTxCtx = txDataObj.ctx ?? undefined;

            // receivedAddress: align with App's fetchTxState
            receivedAddress =
              (txDataObj.receivingAddress as string) ??
              (txDataObj.userAddress as string) ??
              undefined;

            if (!txHash) {
              throw new AppError(
                ERROR_CODES.BIZ_SWAP_FAILED.code,
                `Order "${options.order}" has no txHash (status: ${order.status})`,
                'The order may not have been executed yet. Run "onekey swap execute" first.',
              );
            }
          } else {
            txHash = options.tx;
          }

          // POST /swap/v1/state-tx (aligned with ServiceSwap.fetchTxState)
          const result = await apiClient.post<IStateTxResponse>(
            'swap',
            '/swap/v1/state-tx',
            {
              txId: txHash,
              networkId: chainConfig.networkId,
              protocol: 'Swap',
              ...(provider ? { provider } : {}),
              ...(toTokenAddress ? { toTokenAddress } : {}),
              ...(orderId ? { orderId } : {}),
              ...(receivedAddress ? { receivedAddress } : {}),
              ...(buildTxCtx !== undefined ? { ctx: buildTxCtx } : {}),
            },
          );

          // Validate response has a state field
          if (!result.state || typeof result.state !== 'string') {
            throw new AppError(
              ERROR_CODES.NET_HTTP_ERROR.code,
              'API returned invalid response: missing or invalid "state" field',
              'The swap status API may be temporarily unavailable. Try again later.',
            );
          }

          // Update pending file status when querying by orderId.
          // Skip update for approve_only orders — their txHash is the approve tx,
          // not the swap tx, so the API state would incorrectly overwrite the status.
          if (options.order && result.state && orderStatus !== 'approve_only') {
            const mappedStatus = mapStateToOrderStatus(result.state);
            try {
              updatePendingStatus(options.order, mappedStatus);
            } catch {
              // Non-fatal: status update failure should not block the query result
            }
          }

          output.success(
            {
              state: result.state,
              ...(result.dealReceiveAmount
                ? { dealReceiveAmount: result.dealReceiveAmount }
                : {}),
              ...(result.gasFee ? { gasFee: result.gasFee } : {}),
              ...(result.gasFeeFiatValue
                ? { gasFeeFiatValue: result.gasFeeFiatValue }
                : {}),
              ...(result.crossChainReceiveTxHash
                ? { crossChainReceiveTxHash: result.crossChainReceiveTxHash }
                : {}),
              ...(result.txId ? { txId: result.txId } : {}),
              ...(result.blockNumber
                ? { blockNumber: result.blockNumber }
                : {}),
              ...(options.order ? { orderId: options.order } : {}),
              txHash,
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
