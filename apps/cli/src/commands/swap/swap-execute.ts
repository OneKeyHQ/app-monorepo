import { CHAINS } from '../../config';
import { loadPending, secureCache, updatePendingStatus } from '../../core';
import { AppError, ERROR_CODES } from '../../errors';
import { apiClient } from '../../infra';
import { getSignerByImpl } from '../../signer';
import { confirmTransaction } from '../../utils/confirm-transaction';
import { feeToWeiHex } from '../../utils/tx-utils';

import type { IEndpointEnv } from '../../config';
import type { OutputFormatter } from '../../output';
import type { EvmSigner } from '../../signer/impls/evm/EvmSigner';
import type { Command } from 'commander';

// --- API response types (aligned with transfer.ts) ---

interface IAccountResponse {
  address: string;
  nonce?: number;
}

interface IGasLegacy {
  gasPrice: string;
  gasLimit: string;
}

interface IGasEIP1559 {
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  gasLimit: string;
}

interface IEstimateGasResp {
  isEIP1559: boolean;
  feeDecimals: number;
  feeSymbol: string;
  nativeDecimals: number;
  nativeSymbol: string;
  gas?: IGasLegacy[];
  gasEIP1559?: IGasEIP1559[];
}

interface ISendTransactionResult {
  result: string;
}

// Validate tx hash: 0x + 64 hex chars
const TX_HASH_PATTERN = /^0x[a-fA-F0-9]{64}$/;

// Validate EVM address: 0x + 40 hex chars
const EVM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/i;

// Validate hex calldata: 0x + even number of hex chars (complete bytes)
const HEX_BYTES_PATTERN = /^0x(?:[a-fA-F0-9]{2})*$/i;

// Validate hex quantity (value): 0x + at least one hex char
const HEX_QUANTITY_PATTERN = /^0x[a-fA-F0-9]+$/i;

// ERC-20 approve(address,uint256) function selector
const APPROVE_SELECTOR = '095ea7b3';

// MaxUint256 — unlimited approval
const MAX_UINT256_HEX =
  'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

function buildApproveEncodedTx(
  from: string,
  tokenContract: string,
  spender: string,
): Record<string, string> {
  const paddedSpender = spender.slice(2).toLowerCase().padStart(64, '0');
  const data = `0x${APPROVE_SELECTOR}${paddedSpender}${MAX_UINT256_HEX}`;
  return {
    from,
    to: tokenContract,
    data,
    value: '0x0',
  };
}

/**
 * Estimate gas, fetch nonce, and produce a fully-populated encodedTx
 * ready for signing. Mirrors the gas logic in transfer.ts.
 *
 * @param nonceOverride - If provided, skip nonce fetch and use this value.
 *   Useful when chaining approve → swap to ensure sequential nonces.
 * @returns The signed-ready encodedTx and the nonce used.
 */
async function buildSignableTx(
  networkId: string,
  fromAddress: string,
  encodedTx: Record<string, string>,
  feeDecimals: number,
  nonceOverride?: number,
): Promise<{ encodedTx: Record<string, unknown>; nonce: number }> {
  const feeResp = await apiClient.post<IEstimateGasResp>(
    'wallet',
    '/wallet/v1/account/estimate-fee',
    { networkId, accountAddress: fromAddress, encodedTx },
  );

  if (feeResp.feeDecimals !== feeDecimals) {
    throw new AppError(
      ERROR_CODES.BIZ_UNKNOWN.code,
      `feeDecimals mismatch: API=${feeResp.feeDecimals}, config=${feeDecimals}`,
      'Chain config may be outdated',
    );
  }

  let nonce: number;
  if (nonceOverride !== undefined) {
    nonce = nonceOverride;
  } else {
    const accountInfo = await apiClient.get<IAccountResponse>(
      'wallet',
      '/wallet/v1/account/get-account',
      { networkId, accountAddress: fromAddress, withNonce: true },
    );

    if (accountInfo.nonce === undefined || accountInfo.nonce === null) {
      throw new AppError(
        ERROR_CODES.NET_REQUEST_FAILED.code,
        'API did not return nonce (withNonce=true)',
        'Check API connectivity or retry',
      );
    }
    if (!Number.isSafeInteger(accountInfo.nonce) || accountInfo.nonce < 0) {
      throw new AppError(
        ERROR_CODES.NET_REQUEST_FAILED.code,
        `API returned invalid nonce value: ${accountInfo.nonce}`,
        'Check API connectivity or retry',
      );
    }
    nonce = accountInfo.nonce;
  }

  const chainId = networkId.split('--')[1];

  if (feeResp.isEIP1559) {
    const eipGas = feeResp.gasEIP1559?.[1] ?? feeResp.gasEIP1559?.[0];
    if (
      !eipGas?.gasLimit ||
      !eipGas.maxFeePerGas ||
      !eipGas.maxPriorityFeePerGas
    ) {
      throw new AppError(
        ERROR_CODES.BIZ_GAS_ESTIMATION_FAILED.code,
        'EIP-1559 fee estimation incomplete',
        'API did not return gasLimit/maxFeePerGas/maxPriorityFeePerGas',
      );
    }
    if (!/^\d+$/.test(eipGas.gasLimit)) {
      throw new AppError(
        ERROR_CODES.BIZ_GAS_ESTIMATION_FAILED.code,
        `Invalid gasLimit from API: ${eipGas.gasLimit}`,
        'API returned a non-integer gasLimit',
      );
    }
    if (!/^\d+\.?\d*$/.test(eipGas.maxFeePerGas)) {
      throw new AppError(
        ERROR_CODES.BIZ_GAS_ESTIMATION_FAILED.code,
        `Invalid maxFeePerGas from API: ${eipGas.maxFeePerGas}`,
        'API returned a non-numeric maxFeePerGas',
      );
    }
    if (!/^\d+\.?\d*$/.test(eipGas.maxPriorityFeePerGas)) {
      throw new AppError(
        ERROR_CODES.BIZ_GAS_ESTIMATION_FAILED.code,
        `Invalid maxPriorityFeePerGas from API: ${eipGas.maxPriorityFeePerGas}`,
        'API returned a non-numeric maxPriorityFeePerGas',
      );
    }
    return {
      encodedTx: {
        ...encodedTx,
        nonce,
        chainId,
        gasLimit: eipGas.gasLimit,
        maxFeePerGas: feeToWeiHex(eipGas.maxFeePerGas, feeDecimals),
        maxPriorityFeePerGas: feeToWeiHex(
          eipGas.maxPriorityFeePerGas,
          feeDecimals,
        ),
      },
      nonce,
    };
  }

  const legacyGas = feeResp.gas?.[1] ?? feeResp.gas?.[0];
  if (!legacyGas?.gasLimit || !legacyGas.gasPrice) {
    throw new AppError(
      ERROR_CODES.BIZ_GAS_ESTIMATION_FAILED.code,
      'Legacy fee estimation incomplete',
      'API did not return gasLimit/gasPrice',
    );
  }
  if (!/^\d+$/.test(legacyGas.gasLimit)) {
    throw new AppError(
      ERROR_CODES.BIZ_GAS_ESTIMATION_FAILED.code,
      `Invalid gasLimit from API: ${legacyGas.gasLimit}`,
      'API returned a non-integer gasLimit',
    );
  }
  if (!/^\d+\.?\d*$/.test(legacyGas.gasPrice)) {
    throw new AppError(
      ERROR_CODES.BIZ_GAS_ESTIMATION_FAILED.code,
      `Invalid gasPrice from API: ${legacyGas.gasPrice}`,
      'API returned a non-numeric gasPrice',
    );
  }
  return {
    encodedTx: {
      ...encodedTx,
      nonce,
      chainId,
      gasLimit: legacyGas.gasLimit,
      gasPrice: feeToWeiHex(legacyGas.gasPrice, feeDecimals),
    },
    nonce,
  };
}

export function registerSwapExecuteCommand(parent: Command): void {
  parent
    .command('execute')
    .description('Execute a pending swap order (sign + broadcast)')
    .requiredOption('--chain <chain>', 'Target blockchain (e.g., eth, base)')
    .requiredOption('--order <orderId>', 'Order ID from swap build output')
    .action(
      async (
        options: {
          chain: string;
          order: string;
        },
        command,
      ) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        const globalOpts = command.optsWithGlobals() as Record<string, unknown>;
        const output = globalOpts._outputFormatter as OutputFormatter;
        const skipConfirmation = Boolean(globalOpts.yes);

        try {
          // Validate chain
          const chainConfig = CHAINS[options.chain];
          if (!chainConfig) {
            throw new AppError(
              ERROR_CODES.PARAM_INVALID_CHAIN.code,
              `Unsupported chain: "${options.chain}"`,
              `Valid chains: ${Object.keys(CHAINS).join(', ')}`,
            );
          }

          // Resolve env
          const env = (
            (globalOpts.env as string) === 'prod' ? 'prod' : 'test'
          ) as IEndpointEnv;
          apiClient.setEnv(env);

          // Load pending order (includes 5-minute expiry check)
          const order = loadPending(options.order);

          // Verify chain matches order
          if (order.chain !== options.chain) {
            throw new AppError(
              ERROR_CODES.PARAM_INVALID_CHAIN.code,
              `Order chain "${order.chain}" does not match --chain "${options.chain}"`,
              `Use --chain ${order.chain}`,
            );
          }

          // Only pending orders can be executed
          if (order.status !== 'pending') {
            throw new AppError(
              ERROR_CODES.BIZ_SWAP_FAILED.code,
              `Order "${options.order}" status is "${order.status}", expected "pending"`,
              'Only pending orders can be executed',
            );
          }

          // Validate tx data exists in the pending order
          const txData = order.txData as {
            result?: {
              allowanceResult?: { isEnough?: boolean };
            };
            tx?: Record<string, string>;
          };

          if (!txData.tx || typeof txData.tx !== 'object') {
            throw new AppError(
              ERROR_CODES.BIZ_SWAP_FAILED.code,
              'Order does not contain a valid transaction object',
              'Run "onekey swap build" to create a new order',
            );
          }

          // Runtime validation: tx fields must be well-formed before signing
          const swapTxTo = txData.tx.to;
          if (!swapTxTo || !EVM_ADDRESS_PATTERN.test(swapTxTo)) {
            throw new AppError(
              ERROR_CODES.BIZ_SWAP_FAILED.code,
              `Invalid tx.to in order: "${swapTxTo ?? ''}" is not a valid EVM address`,
              'Run "onekey swap build" to create a new order',
            );
          }
          if (
            txData.tx.data !== undefined &&
            !HEX_BYTES_PATTERN.test(txData.tx.data)
          ) {
            throw new AppError(
              ERROR_CODES.BIZ_SWAP_FAILED.code,
              'Invalid tx.data in order: not a valid hex byte string (must be even-length)',
              'Run "onekey swap build" to create a new order',
            );
          }
          if (
            txData.tx.value !== undefined &&
            !HEX_QUANTITY_PATTERN.test(txData.tx.value)
          ) {
            throw new AppError(
              ERROR_CODES.BIZ_SWAP_FAILED.code,
              'Invalid tx.value in order: not a valid hex quantity',
              'Run "onekey swap build" to create a new order',
            );
          }

          // Check if token approval is required (before confirmation so we can inform the user)
          const needsApprove =
            txData.result?.allowanceResult !== undefined &&
            txData.result.allowanceResult !== null &&
            txData.result.allowanceResult.isEnough === false;

          // Build confirmation action string — include approve info if applicable
          let confirmAction = `Swap ${order.amount} ${order.fromToken.symbol} → ${order.toToken.symbol}`;
          if (needsApprove) {
            confirmAction = `Approve unlimited ${order.fromToken.symbol} allowance to ${swapTxTo}, then swap ${order.amount} ${order.fromToken.symbol} → ${order.toToken.symbol} (2 transactions)`;
          }

          // Confirm execution (prompts in human mode, rejects JSON without --yes)
          await confirmTransaction({
            info: {
              action: confirmAction,
              to: order.provider ?? 'swap provider',
              value: `${order.amount} ${order.fromToken.symbol}`,
              network: options.chain,
            },
            output,
            skipConfirmation,
          });

          // Get wallet signer and address
          const signer = (await getSignerByImpl(chainConfig.impl)) as EvmSigner;
          const addressInfo = await signer.getAddress(chainConfig.networkId);
          const fromAddress = addressInfo.address;

          // Prepare sign credentials once for both approve + swap
          const hdCredential = await signer.getHdCredential();
          const encodedPassword = await signer.getEncodedPassword();
          const networkInfo = signer.buildNetworkInfo(chainConfig.networkId);
          const accountForSign = {
            address: fromAddress,
            path: addressInfo.path ?? "m/44'/60'/0'/0/0",
            pub: addressInfo.publicKey,
          };

          let approveTxHash: string | undefined;
          let approveNonce: number | undefined;

          if (needsApprove) {
            if (!order.fromToken.contractAddress) {
              throw new AppError(
                ERROR_CODES.BIZ_SWAP_FAILED.code,
                'Approve required but fromToken has no contract address (native token)',
                'This should not happen — rebuild the order',
              );
            }

            // Validate fromToken contract address is a legitimate EVM address
            if (!EVM_ADDRESS_PATTERN.test(order.fromToken.contractAddress)) {
              throw new AppError(
                ERROR_CODES.BIZ_SWAP_FAILED.code,
                `Invalid fromToken contract address: "${order.fromToken.contractAddress}"`,
                'Run "onekey swap build" to create a new order',
              );
            }

            // Spender is the swap router contract (the tx.to field)
            const spender = txData.tx.to;
            if (!spender) {
              throw new AppError(
                ERROR_CODES.BIZ_SWAP_FAILED.code,
                'Cannot determine approve spender from swap tx data',
                'Run "onekey swap build" to create a new order',
              );
            }

            output.info('Approving token allowance...');

            const approveEncodedTx = buildApproveEncodedTx(
              fromAddress,
              order.fromToken.contractAddress,
              spender,
            );

            const approveBuilt = await buildSignableTx(
              chainConfig.networkId,
              fromAddress,
              approveEncodedTx,
              chainConfig.feeDecimals,
            );
            approveNonce = approveBuilt.nonce;

            const approveSignedTx = await signer.signTransaction({
              networkInfo,
              password: encodedPassword,
              credentials: { hd: hdCredential },
              account: accountForSign,
              unsignedTx: { encodedTx: approveBuilt.encodedTx },
            });

            const approveResult = await apiClient.post<ISendTransactionResult>(
              'wallet',
              '/wallet/v1/account/send-transaction',
              {
                networkId: chainConfig.networkId,
                accountAddress: fromAddress,
                tx: approveSignedTx.rawTx,
              },
            );

            if (
              !approveResult?.result ||
              !TX_HASH_PATTERN.test(approveResult.result)
            ) {
              throw new AppError(
                ERROR_CODES.BIZ_TRANSACTION_FAILED.code,
                `Approve broadcast returned invalid txid: "${approveResult?.result ?? ''}"`,
                'Check the transaction on chain explorer manually',
              );
            }

            approveTxHash = approveResult.result;
            output.info(`Approve tx broadcast: ${approveTxHash}`);
          }

          // Sign and broadcast swap tx
          try {
            const swapEncodedTx: Record<string, string> = {
              ...txData.tx,
              from: fromAddress,
            };

            // If approve was sent, use approveNonce+1 to ensure sequential ordering
            const swapNonceOverride =
              approveNonce !== undefined ? approveNonce + 1 : undefined;

            const swapBuilt = await buildSignableTx(
              chainConfig.networkId,
              fromAddress,
              swapEncodedTx,
              chainConfig.feeDecimals,
              swapNonceOverride,
            );

            const swapSignedTx = await signer.signTransaction({
              networkInfo,
              password: encodedPassword,
              credentials: { hd: hdCredential },
              account: accountForSign,
              unsignedTx: { encodedTx: swapBuilt.encodedTx },
            });

            const swapResult = await apiClient.post<ISendTransactionResult>(
              'wallet',
              '/wallet/v1/account/send-transaction',
              {
                networkId: chainConfig.networkId,
                accountAddress: fromAddress,
                tx: swapSignedTx.rawTx,
              },
            );

            if (
              !swapResult?.result ||
              !TX_HASH_PATTERN.test(swapResult.result)
            ) {
              throw new AppError(
                ERROR_CODES.BIZ_TRANSACTION_FAILED.code,
                `Swap broadcast returned invalid txid: "${swapResult?.result ?? ''}"`,
                'Check the transaction on chain explorer manually',
              );
            }

            // Update pending status to executed
            updatePendingStatus(options.order, 'executed', {
              txHash: swapResult.result,
            });

            output.success(
              {
                orderId: options.order,
                status: 'executed',
                txHash: swapResult.result,
                ...(approveTxHash ? { approveTxHash } : {}),
                chain: options.chain,
                from: order.fromToken.symbol,
                to: order.toToken.symbol,
                amount: order.amount,
              },
              { chain: options.chain },
            );
          } catch (swapError) {
            // Approve succeeded but swap failed — mark as approve_only
            if (approveTxHash) {
              const swapAppError = AppError.from(swapError);
              let statusWarning = '';
              try {
                updatePendingStatus(options.order, 'approve_only');
              } catch {
                statusWarning =
                  ' Warning: failed to update local order status to approve_only.';
              }
              output.error({
                code: swapAppError.code,
                message: `Approve succeeded (tx: ${approveTxHash}) but swap failed: ${swapAppError.message}. Token allowance has been granted.${statusWarning}`,
                suggestion:
                  'Run "onekey swap build" then "onekey swap execute" to retry the swap',
              });
              process.exitCode = swapAppError.exitCode;
              return;
            }
            throw swapError;
          }
        } catch (error) {
          const appError = AppError.from(error);
          output.error(appError.toErrorDetail());
          process.exitCode = appError.exitCode;
        } finally {
          secureCache.clearAll();
        }
      },
    );
}
