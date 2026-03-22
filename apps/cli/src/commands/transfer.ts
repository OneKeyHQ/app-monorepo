import { CHAINS } from '../config';
import { AppError, ERROR_CODES } from '../errors';
import { apiClient } from '../infra';
import { transferOptionsSchema } from '../schemas';
import { getSignerByImpl } from '../signer';
import { confirmTransaction } from '../utils/confirm-transaction';
import {
  buildErc20EncodedTx,
  buildNativeEncodedTx,
  estimateGasCostDisplay,
  feeToWeiHex,
  validateAmountDecimals,
} from '../utils/tx-utils';

import type { OutputFormatter } from '../output';
import type { EvmSigner } from '../signer/impls/evm/EvmSigner';
import type { Command } from 'commander';

interface IAccountResponse {
  address: string;
  nonce?: number;
}

interface ITokenInfo {
  decimals: number;
  symbol: string;
  name: string;
}

interface IFeeEstimation {
  common: {
    feeDecimals: number;
    feeSymbol: string;
    nativeDecimals: number;
    nativeSymbol: string;
  };
  gas?: Array<{
    gasPrice?: string;
    gasLimit?: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
  }>;
}

interface ISendTransactionResult {
  txid: string;
}

export function registerTransferCommand(program: Command): void {
  program
    .command('transfer')
    .description('Send native token or ERC-20 to an address')
    .requiredOption('--to <address>', 'Recipient address')
    .requiredOption('--amount <amount>', 'Amount to send (human-readable)')
    .option('--token <address>', 'ERC-20 token contract address')
    .option('--chain <chain>', 'Target blockchain (e.g., eth, bsc)', 'eth')
    .option('--dry-run', 'Estimate fees without sending')
    .action(
      async (
        options: {
          to: string;
          amount: string;
          token?: string;
          chain: string;
          dryRun?: boolean;
        },
        command,
      ) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        const globalOpts = command.optsWithGlobals() as Record<string, unknown>;
        const output = globalOpts._outputFormatter as OutputFormatter;
        const skipConfirmation = Boolean(globalOpts.yes);

        try {
          const validated = transferOptionsSchema.parse({
            to: options.to,
            amount: options.amount,
            token: options.token,
            chain: options.chain,
            dryRun: options.dryRun,
            yes: skipConfirmation,
          });

          const chainName = validated.chain ?? 'eth';
          const chainConfig = CHAINS[chainName];
          if (!chainConfig) {
            throw new AppError(
              ERROR_CODES.PARAM_INVALID_CHAIN.code,
              `Unsupported chain: ${chainName}`,
              `Supported: ${Object.keys(CHAINS).join(', ')}`,
            );
          }

          const { feeDecimals, nativeDecimals, nativeSymbol } = chainConfig;

          const signer = (await getSignerByImpl(chainConfig.impl)) as EvmSigner;
          const addressInfo = await signer.getAddress(chainConfig.networkId);
          const fromAddress = addressInfo.address;

          // Validate amount precision against chain/token decimals
          let encodedTx: Record<string, string>;
          if (validated.token) {
            const tokenInfo = await apiClient.get<ITokenInfo>(
              'wallet',
              '/wallet/v1/account/token/search',
              {
                networkId: chainConfig.networkId,
                contractList: validated.token,
              },
            );
            if (!tokenInfo?.decimals && tokenInfo?.decimals !== 0) {
              throw new AppError(
                ERROR_CODES.PARAM_INVALID_TOKEN.code,
                `Cannot resolve decimals for token ${validated.token}`,
                'Verify the token contract address is correct',
              );
            }
            validateAmountDecimals(validated.amount, tokenInfo.decimals);
            encodedTx = buildErc20EncodedTx(
              fromAddress,
              validated.to,
              validated.amount,
              validated.token,
              tokenInfo.decimals,
            );
          } else {
            validateAmountDecimals(validated.amount, nativeDecimals);
            encodedTx = buildNativeEncodedTx(
              fromAddress,
              validated.to,
              validated.amount,
            );
          }

          // Estimate fee
          const feeEstimation = await apiClient.post<IFeeEstimation>(
            'wallet',
            '/wallet/v1/account/estimate-fee',
            {
              networkId: chainConfig.networkId,
              accountAddress: fromAddress,
              encodedTx,
            },
          );

          const gasInfo = feeEstimation.gas?.[1] ?? feeEstimation.gas?.[0];
          if (!gasInfo?.gasLimit) {
            throw new AppError(
              ERROR_CODES.BIZ_UNKNOWN.code,
              'Fee estimation returned no gas data',
              'The API did not return gasLimit — cannot proceed safely',
            );
          }

          // Verify API decimals match chain config
          if (
            feeEstimation.common?.feeDecimals !== undefined &&
            feeEstimation.common.feeDecimals !== feeDecimals
          ) {
            throw new AppError(
              ERROR_CODES.BIZ_UNKNOWN.code,
              `feeDecimals mismatch: API returned ${feeEstimation.common.feeDecimals}, chain config has ${feeDecimals}`,
              `Chain ${chainName} decimals config may be outdated — verify against presetNetworks.ts`,
            );
          }

          if (
            feeEstimation.common?.nativeDecimals !== undefined &&
            feeEstimation.common.nativeDecimals !== nativeDecimals
          ) {
            throw new AppError(
              ERROR_CODES.BIZ_UNKNOWN.code,
              `nativeDecimals mismatch: API returned ${feeEstimation.common.nativeDecimals}, chain config has ${nativeDecimals}`,
              `Chain ${chainName} decimals config may be outdated — verify against presetNetworks.ts`,
            );
          }

          const estimatedGasDisplay = estimateGasCostDisplay(
            gasInfo.gasLimit,
            gasInfo.maxFeePerGas ?? gasInfo.gasPrice ?? '0',
            feeDecimals,
            nativeSymbol,
            nativeDecimals,
          );

          // Dry run — just show preview
          if (validated.dryRun) {
            output.success({
              action: validated.token
                ? `Transfer ERC-20`
                : `Transfer ${validated.amount} ${nativeSymbol}`,
              from: fromAddress,
              to: validated.to,
              amount: validated.amount,
              token: validated.token ?? 'native',
              chain: chainName,
              estimatedGas: estimatedGasDisplay,
              dryRun: true,
            });
            return;
          }

          // Confirm
          await confirmTransaction({
            info: {
              action: validated.token
                ? `Transfer ERC-20`
                : `Transfer ${validated.amount} ${nativeSymbol}`,
              to: validated.to,
              value: validated.amount,
              network: chainName,
              estimatedGas: estimatedGasDisplay,
            },
            output,
            skipConfirmation,
          });

          // Build sign payload
          const hdCredential = await signer.getHdCredential();
          const encodedPassword = await signer.getEncodedPassword();
          const networkInfo = signer.buildNetworkInfo(chainConfig.networkId);
          const chainId = chainConfig.networkId.split('--')[1];

          // Fetch nonce via get-account with withNonce flag
          const accountInfo = await apiClient.get<IAccountResponse>(
            'wallet',
            '/wallet/v1/account/get-account',
            {
              networkId: chainConfig.networkId,
              accountAddress: fromAddress,
              withNonce: true,
            },
          );

          // Validate nonce — never fallback to 0
          if (accountInfo.nonce === undefined || accountInfo.nonce === null) {
            throw new AppError(
              ERROR_CODES.NET_REQUEST_FAILED.code,
              'API did not return nonce (withNonce=true). Cannot sign safely.',
              'Check API connectivity or retry',
            );
          }

          // Validate gas price fields — never fallback to '0'
          const isEIP1559 = Boolean(gasInfo.maxFeePerGas);
          if (isEIP1559) {
            if (!gasInfo.maxFeePerGas || !gasInfo.maxPriorityFeePerGas) {
              throw new AppError(
                ERROR_CODES.BIZ_GAS_ESTIMATION_FAILED.code,
                'EIP-1559 fee estimation incomplete: missing maxFeePerGas or maxPriorityFeePerGas',
                'Retry or check API response',
              );
            }
          } else if (!gasInfo.gasPrice) {
            throw new AppError(
              ERROR_CODES.BIZ_GAS_ESTIMATION_FAILED.code,
              'Legacy fee estimation incomplete: missing gasPrice',
              'Retry or check API response',
            );
          }

          // Build complete encodedTx for signing
          // Gas prices from API are in feeDecimals units (e.g. Gwei), must convert to wei hex
          const encodedTxWithGas = {
            ...encodedTx,
            nonce: accountInfo.nonce,
            chainId,
            gasLimit: gasInfo.gasLimit,
            ...(isEIP1559
              ? {
                  maxFeePerGas: feeToWeiHex(gasInfo.maxFeePerGas!, feeDecimals),
                  maxPriorityFeePerGas: feeToWeiHex(
                    gasInfo.maxPriorityFeePerGas!,
                    feeDecimals,
                  ),
                }
              : {
                  gasPrice: feeToWeiHex(gasInfo.gasPrice!, feeDecimals),
                }),
          };

          const signPayload = {
            networkInfo,
            password: encodedPassword,
            credentials: { hd: hdCredential },
            account: {
              address: fromAddress,
              path: addressInfo.path ?? "m/44'/60'/0'/0/0",
              pub: addressInfo.pub,
            },
            unsignedTx: {
              encodedTx: encodedTxWithGas,
            },
          };

          const signedTx = await signer.signTransaction(signPayload);

          // Broadcast
          const result = await apiClient.post<ISendTransactionResult>(
            'wallet',
            '/wallet/v1/account/send-transaction',
            {
              networkId: chainConfig.networkId,
              accountAddress: fromAddress,
              tx: signedTx.rawTx,
              signedTx,
            },
          );

          output.success(
            {
              txid: result.txid ?? signedTx.txid,
              from: fromAddress,
              to: validated.to,
              amount: validated.amount,
              chain: chainName,
            },
            { chain: chainName },
          );
        } catch (error) {
          const appError = AppError.from(error);
          output.error(appError.toErrorDetail());
          process.exitCode = appError.exitCode;
        }
      },
    );
}
