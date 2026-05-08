import { loadPending, updatePendingStatus } from '../../core';
import { resolveChain } from '../../core/chain-resolver';
import { AppError, ERROR_CODES } from '../../errors';
import { apiClient } from '../../infra';
import {
  requireAuthenticatedCommand,
  requireStringOption,
} from '../command-guards';

import { renderBridgeStatus } from './swap-display-utils';
import {
  BRIDGE_CONFIG,
  SWAP_CONFIG,
  getProtocolConfig,
} from './swap-protocol-config';

import type { IEndpointEnv } from '../../config';
import type { OutputFormatter } from '../../output';
import type { Command } from 'commander';

interface IStateTxResponse {
  state: string;
  crossChainStatus?: string;
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
    .option('--chain <chain>', 'Target blockchain (e.g., eth, base, required)')
    .option('--order <orderId>', 'Order ID from swap build output')
    .option('--tx <txHash>', 'Transaction hash to query')
    .option(
      '--watch',
      'Poll until final state (bridge: 10s interval, swap: 3s)',
    )
    .option(
      '--protocol <protocol>',
      'Protocol type: swap or bridge (default: swap, auto-detected from order)',
      'swap',
    )
    .action(
      async (
        options: {
          chain?: string;
          order?: string;
          tx?: string;
          watch?: boolean;
          protocol?: string;
        },
        command,
      ) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        const globalOpts = command.optsWithGlobals() as Record<string, unknown>;
        const output = globalOpts._outputFormatter as OutputFormatter;

        try {
          await requireAuthenticatedCommand();

          const chain = requireStringOption(options.chain, '--chain <chain>');

          // Validate: at least one of --order or --tx is required
          if (!options.order && !options.tx) {
            throw new AppError(
              ERROR_CODES.PARAM_MISSING_REQUIRED.code,
              'Either --order or --tx is required',
              'Usage: onekey swap status --chain eth --order <orderId> or --tx <txHash>',
            );
          }

          // Validate chain
          const chainConfig = resolveChain(chain);

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
          let order: ReturnType<typeof loadPending> | undefined;

          if (options.order) {
            // Load order without expiry check — status queries should work for old orders
            order = loadPending(options.order, { skipExpiry: true });

            // Verify chain matches
            if (order.chain !== chain) {
              throw new AppError(
                ERROR_CODES.PARAM_INVALID_CHAIN.code,
                `Order chain "${order.chain}" does not match --chain "${chain}"`,
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

          // Determine protocol config
          const protocolType =
            order?.protocolType ??
            (options.protocol === 'bridge' ? 'Bridge' : 'Swap');
          let protocolConfig;
          if (order) {
            protocolConfig = getProtocolConfig(
              order.networkId,
              order.toNetworkId ?? order.networkId,
            );
          } else {
            protocolConfig =
              protocolType === 'Bridge' ? BRIDGE_CONFIG : SWAP_CONFIG;
          }

          // Build the state-tx POST body (reused for single query and --watch)
          const stateTxBody = {
            txId: txHash,
            networkId: chainConfig.networkId,
            protocol: 'Swap', // API uses 'Swap' for both swap and bridge
            ...(provider ? { provider } : {}),
            ...(toTokenAddress ? { toTokenAddress } : {}),
            ...(orderId ? { orderId } : {}),
            ...(receivedAddress ? { receivedAddress } : {}),
            ...(buildTxCtx !== undefined ? { ctx: buildTxCtx } : {}),
            // Note: do NOT send toNetworkId — state-tx API does not accept it
            // (App doesn't send it either; backend resolves destination from txId)
          };

          // --watch: poll until final state
          if (options.watch) {
            const isJsonMode = output.getMode() === 'agent';
            let lastLineCount = 0;
            let attempts = 0;

            const poll = async (): Promise<void> => {
              const response = await apiClient.post<IStateTxResponse>(
                'swap',
                '/swap/v1/state-tx',
                stateTxBody,
              );

              const currentState =
                protocolConfig.protocol === 'Bridge'
                  ? (response.crossChainStatus ?? response.state)
                  : response.state;
              const stateInfo = protocolConfig.mapApiState(currentState);

              if (isJsonMode) {
                // NDJSON: one JSON object per line
                output.raw(JSON.stringify({ ...response, stateInfo }));
              } else {
                // TTY: clear previous multi-line output
                if (lastLineCount > 0) {
                  process.stdout.moveCursor(0, -lastLineCount);
                  for (let i = 0; i < lastLineCount; i += 1) {
                    process.stdout.clearLine(0);
                    if (i < lastLineCount - 1) {
                      process.stdout.moveCursor(0, 1);
                    }
                  }
                  process.stdout.moveCursor(0, -(lastLineCount - 1));
                }
                const displayData = {
                  fromTxHash: order?.txHash,
                  crossChainReceiveTxHash: response.crossChainReceiveTxHash,
                  fromAmount: order?.amount,
                  fromSymbol: order?.fromToken?.symbol,
                  fromChainName: order?.networkId,
                  toAmount: response.dealReceiveAmount,
                  toSymbol: order?.toToken?.symbol,
                  toChainName: order?.toNetworkId,
                };
                const watchOutput = renderBridgeStatus({
                  ...stateInfo,
                  ...displayData,
                });
                output.raw(watchOutput);
                lastLineCount = watchOutput.split('\n').length;
              }

              if (stateInfo.isFinal) return;
              if (attempts >= protocolConfig.statusMaxPollAttempts) {
                output.raw(
                  'Timeout — poll limit reached. Try again later.',
                  'stderr',
                );
                return;
              }
              attempts += 1;
              await new Promise((r) => {
                setTimeout(r, protocolConfig.statusPollIntervalMs);
              });
              await poll();
            };

            await poll();
            return;
          }

          // Single query: POST /swap/v1/state-tx
          const result = await apiClient.post<IStateTxResponse>(
            'swap',
            '/swap/v1/state-tx',
            stateTxBody,
          );

          // Validate response has a state field
          if (!result.state || typeof result.state !== 'string') {
            throw new AppError(
              ERROR_CODES.NET_HTTP_ERROR.code,
              'API returned invalid response: missing or invalid "state" field',
              'The swap status API may be temporarily unavailable. Try again later.',
            );
          }

          // Map state using protocol config for display
          const currentState =
            protocolConfig.protocol === 'Bridge'
              ? (result.crossChainStatus ?? result.state)
              : result.state;
          const stateInfo = protocolConfig.mapApiState(currentState);

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

          // For bridge orders in human (non-JSON) mode, use rich status display
          if (
            protocolConfig.protocol === 'Bridge' &&
            output.getMode() === 'human'
          ) {
            const displayData = {
              fromTxHash: order?.txHash,
              crossChainReceiveTxHash: result.crossChainReceiveTxHash,
              fromAmount: order?.amount,
              fromSymbol: order?.fromToken?.symbol,
              fromChainName: order?.networkId,
              toAmount: result.dealReceiveAmount,
              toSymbol: order?.toToken?.symbol,
              toChainName: order?.toNetworkId,
            };
            const bridgeOutput = renderBridgeStatus({
              ...stateInfo,
              ...displayData,
            });
            output.raw(bridgeOutput);
          } else {
            output.success(
              {
                state: result.state,
                ...(result.crossChainStatus
                  ? { crossChainStatus: result.crossChainStatus }
                  : {}),
                ...(result.dealReceiveAmount
                  ? { dealReceiveAmount: result.dealReceiveAmount }
                  : {}),
                ...(result.gasFee ? { gasFee: result.gasFee } : {}),
                ...(result.gasFeeFiatValue
                  ? { gasFeeFiatValue: result.gasFeeFiatValue }
                  : {}),
                ...(result.crossChainReceiveTxHash
                  ? {
                      crossChainReceiveTxHash: result.crossChainReceiveTxHash,
                    }
                  : {}),
                ...(result.txId ? { txId: result.txId } : {}),
                ...(result.blockNumber
                  ? { blockNumber: result.blockNumber }
                  : {}),
                ...(options.order ? { orderId: options.order } : {}),
                txHash,
                stateLabel: stateInfo.label,
                ...(protocolConfig.protocol === 'Bridge'
                  ? {
                      stage: stateInfo.stage,
                      totalStages: stateInfo.total,
                    }
                  : {}),
              },
              { chain },
            );
          }
        } catch (error) {
          const appError = AppError.from(error);
          output.error(appError.toErrorDetail());
          process.exitCode = appError.exitCode;
        }
      },
    );
}
