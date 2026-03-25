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

// GET /swap/v1/allowance response (matches App's ISwapApproveAllowanceResponse)
interface IAllowanceCheckResponse {
  isApproved: boolean;
  allowanceTarget: string;
  shouldApproveAmount: string;
  approvedAmount: string;
  shouldResetApprove?: boolean;
}

// build-tx response's allowanceResult (matches App's IAllowanceResult)
interface IAllowanceResult {
  allowanceTarget: string;
  amount: string;
  shouldResetApprove?: boolean;
}

// Validate tx hash: 0x + 64 hex chars
const TX_HASH_PATTERN = /^0x[a-fA-F0-9]{64}$/;

// Validate EVM address: 0x + 40 hex chars
const EVM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/i;

// Validate hex calldata: 0x + even number of hex chars (complete bytes)
const HEX_BYTES_PATTERN = /^0x(?:[a-fA-F0-9]{2})*$/i;

// Validate tx value: either "0x" hex quantity or plain decimal integer (API may return either)
const TX_VALUE_PATTERN = /^(?:0x[a-fA-F0-9]+|\d+)$/i;

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
 * Check on-chain allowance via the swap API (same endpoint the App uses).
 */
async function checkAllowance(
  networkId: string,
  tokenAddress: string,
  spenderAddress: string,
  walletAddress: string,
  amount: string,
): Promise<IAllowanceCheckResponse> {
  return apiClient.get<IAllowanceCheckResponse>('swap', '/swap/v1/allowance', {
    networkId,
    tokenAddress,
    spenderAddress,
    walletAddress,
    amount,
  });
}

/**
 * Poll the allowance API until approval is confirmed or timeout.
 * Base block time ~2s; polls every 3s for up to 30s.
 */
async function waitForApproveConfirmation(
  networkId: string,
  tokenAddress: string,
  spenderAddress: string,
  walletAddress: string,
  amount: string,
): Promise<void> {
  const maxAttempts = 10;
  const intervalMs = 3000;
  for (let i = 0; i < maxAttempts; i += 1) {
    await new Promise((resolve) => {
      setTimeout(resolve, intervalMs);
    });
    try {
      const resp = await checkAllowance(
        networkId,
        tokenAddress,
        spenderAddress,
        walletAddress,
        amount,
      );
      if (resp.isApproved) return;
    } catch {
      // Ignore transient API errors during polling
    }
  }
  throw new AppError(
    ERROR_CODES.BIZ_SWAP_FAILED.code,
    'Approve transaction not confirmed within 30 seconds',
    'Check the approve tx on chain explorer, then retry "onekey swap execute"',
  );
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
              allowanceResult?: IAllowanceResult;
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
            !TX_VALUE_PATTERN.test(txData.tx.value)
          ) {
            throw new AppError(
              ERROR_CODES.BIZ_SWAP_FAILED.code,
              'Invalid tx.value in order: not a valid hex or decimal value',
              'Run "onekey swap build" to create a new order',
            );
          }

          // Get wallet address early — needed for allowance check and address validation
          const signer = (await getSignerByImpl(chainConfig.impl)) as EvmSigner;
          const addressInfo = await signer.getAddress(chainConfig.networkId);
          const fromAddress = addressInfo.address;

          // Verify current wallet matches the address used at build time.
          const buildTimeFrom = txData.tx.from;
          if (
            buildTimeFrom &&
            buildTimeFrom.toLowerCase() !== fromAddress.toLowerCase()
          ) {
            throw new AppError(
              ERROR_CODES.BIZ_SWAP_FAILED.code,
              `Wallet address mismatch: order was built for ${buildTimeFrom}, but current wallet is ${fromAddress}`,
              'Run "onekey swap build" again with the current wallet',
            );
          }

          // Determine if token approval is needed by calling the on-chain allowance API.
          // For ERC-20 fromTokens, ALWAYS check — the build-tx API may or may not
          // include allowanceResult depending on the provider.
          const buildAllowance = txData.result?.allowanceResult;
          let needsApprove = false;
          let approveSpender = '';
          let approveCheckAmount = '0';

          if (order.fromToken.contractAddress) {
            // Spender: prefer allowanceResult.allowanceTarget, fall back to tx.to (router)
            approveSpender =
              buildAllowance?.allowanceTarget ?? txData.tx.to ?? '';
            if (!approveSpender) {
              throw new AppError(
                ERROR_CODES.BIZ_SWAP_FAILED.code,
                'Cannot determine approve spender address',
                'Run "onekey swap build" to create a new order',
              );
            }

            const txDataRecord: Record<string, unknown> = order.txData;
            const checkAmount =
              buildAllowance?.amount ?? txDataRecord.fromTokenAmount ?? '0';
            approveCheckAmount =
              typeof checkAmount === 'string'
                ? checkAmount
                : String(checkAmount);

            const onChainAllowance = await checkAllowance(
              chainConfig.networkId,
              order.fromToken.contractAddress,
              approveSpender,
              fromAddress,
              approveCheckAmount,
            );
            needsApprove = !onChainAllowance.isApproved;
          }

          // Build confirmation action string — include approve info if applicable
          let confirmAction = `Swap ${order.amount} ${order.fromToken.symbol} → ${order.toToken.symbol}`;
          if (needsApprove) {
            confirmAction = `Approve unlimited ${order.fromToken.symbol} allowance to ${approveSpender}, then swap ${order.amount} ${order.fromToken.symbol} → ${order.toToken.symbol} (2 transactions)`;
          }

          // Confirm execution — show real tx.to (router contract), not just provider name
          await confirmTransaction({
            info: {
              action: confirmAction,
              to: `${swapTxTo} (${order.provider ?? 'swap provider'})`,
              value: `${order.amount} ${order.fromToken.symbol}`,
              network: options.chain,
            },
            output,
            skipConfirmation,
          });

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
            // Validate fromToken contract address is a legitimate EVM address
            if (!EVM_ADDRESS_PATTERN.test(order.fromToken.contractAddress)) {
              throw new AppError(
                ERROR_CODES.BIZ_SWAP_FAILED.code,
                `Invalid fromToken contract address: "${order.fromToken.contractAddress}"`,
                'Run "onekey swap build" to create a new order',
              );
            }
            if (!EVM_ADDRESS_PATTERN.test(approveSpender)) {
              throw new AppError(
                ERROR_CODES.BIZ_SWAP_FAILED.code,
                `Invalid allowanceTarget (spender): "${approveSpender}"`,
                'Run "onekey swap build" to create a new order',
              );
            }

            output.info(
              `Approving ${order.fromToken.symbol} for spender ${approveSpender}...`,
            );

            const approveEncodedTx = buildApproveEncodedTx(
              fromAddress,
              order.fromToken.contractAddress,
              approveSpender,
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
            output.info(
              `Approve tx broadcast: ${approveTxHash}. Waiting for confirmation...`,
            );

            // Wait for approve to be confirmed on-chain before swap gas estimation
            await waitForApproveConfirmation(
              chainConfig.networkId,
              order.fromToken.contractAddress,
              approveSpender,
              fromAddress,
              approveCheckAmount,
            );
            output.info('Approve confirmed on-chain.');
          }

          // Sign and broadcast swap tx
          try {
            // Normalize value: the swap API may return "0" (decimal) but
            // estimate-fee expects "0x0" (hex) for on-chain simulation
            const rawValue = txData.tx.value;
            let normalizedValue = rawValue;
            if (rawValue !== undefined && !rawValue.startsWith('0x')) {
              normalizedValue = `0x${BigInt(rawValue).toString(16)}`;
            }

            const swapEncodedTx: Record<string, string> = {
              ...txData.tx,
              from: fromAddress,
              ...(normalizedValue !== undefined
                ? { value: normalizedValue }
                : {}),
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
