import { CHAINS } from '../config';
import { AppError, ERROR_CODES } from '../errors';
import { apiClient } from '../infra';
import { transferOptionsSchema } from '../schemas';
import { getSignerByImpl } from '../signer';
import { CLI_PASSWORD } from '../signer/base/SignerBase';
import { confirmTransaction } from '../utils/confirm-transaction';

import type { OutputFormatter } from '../output';
import type { EvmSigner } from '../signer/impls/evm/EvmSigner';
import type { Command } from 'commander';

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

function amountToWei(amount: string, decimals: number): string {
  const parts = amount.split('.');
  const wholePart = parts[0];
  const fracPart = (parts[1] ?? '').padEnd(decimals, '0').slice(0, decimals);
  const raw = `${wholePart}${fracPart}`.replace(/^0+/, '') || '0';
  return raw;
}

function weiToDisplay(wei: string, decimals: number): string {
  const padded = wei.padStart(decimals + 1, '0');
  const whole = padded.slice(0, padded.length - decimals) || '0';
  const frac = padded.slice(padded.length - decimals);
  const trimmed = frac.replace(/0+$/, '');
  return trimmed ? `${whole}.${trimmed}` : whole;
}

function buildNativeEncodedTx(
  from: string,
  to: string,
  amount: string,
): Record<string, string> {
  return {
    from,
    to,
    value: `0x${BigInt(amountToWei(amount, 18)).toString(16)}`,
  };
}

function buildErc20EncodedTx(
  from: string,
  to: string,
  amount: string,
  tokenContract: string,
): Record<string, string> {
  // ERC-20 transfer(address,uint256) function selector + ABI encoded args
  // For MVP, assume 18 decimals (most common). Token decimals query can be added later.
  const selector = 'a9059cbb';
  const paddedTo = to.slice(2).toLowerCase().padStart(64, '0');
  const weiAmount = BigInt(amountToWei(amount, 18))
    .toString(16)
    .padStart(64, '0');
  const data = `0x${selector}${paddedTo}${weiAmount}`;

  return {
    from,
    to: tokenContract,
    data,
    value: '0x0',
  };
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

          const signer = (await getSignerByImpl(chainConfig.impl)) as EvmSigner;
          const addressInfo = await signer.getAddress(chainConfig.networkId);
          const fromAddress = addressInfo.address;

          // Build encoded tx
          const encodedTx = validated.token
            ? buildErc20EncodedTx(
                fromAddress,
                validated.to,
                validated.amount,
                validated.token,
              )
            : buildNativeEncodedTx(fromAddress, validated.to, validated.amount);

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
          const feeDecimals =
            feeEstimation.common?.feeDecimals ??
            feeEstimation.common?.nativeDecimals ??
            18;
          const feeSymbol =
            feeEstimation.common?.feeSymbol ??
            feeEstimation.common?.nativeSymbol ??
            'ETH';

          let estimatedGasDisplay = 'unknown';
          if (gasInfo) {
            const gasLimit = gasInfo.gasLimit ?? '21000';
            const gasPrice = gasInfo.maxFeePerGas ?? gasInfo.gasPrice ?? '0';
            const gasCostWei = (BigInt(gasLimit) * BigInt(gasPrice)).toString();
            estimatedGasDisplay = `${weiToDisplay(gasCostWei, feeDecimals)} ${feeSymbol}`;
          }

          // Dry run — just show preview
          if (validated.dryRun) {
            output.success({
              action: validated.token
                ? `Transfer ERC-20`
                : `Transfer ${validated.amount} ${feeSymbol}`,
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
                : `Transfer ${validated.amount} ${feeSymbol}`,
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
          const networkInfo = signer.buildNetworkInfo(chainConfig.networkId);

          // Attach gas info to encodedTx for signing
          const encodedTxWithGas = gasInfo
            ? {
                ...encodedTx,
                gasLimit: gasInfo.gasLimit,
                ...(gasInfo.maxFeePerGas
                  ? {
                      maxFeePerGas: gasInfo.maxFeePerGas,
                      maxPriorityFeePerGas: gasInfo.maxPriorityFeePerGas,
                    }
                  : { gasPrice: gasInfo.gasPrice }),
              }
            : encodedTx;

          const signPayload = {
            networkInfo,
            password: CLI_PASSWORD,
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
