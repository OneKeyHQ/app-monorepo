import { resolveChain } from '../core/chain-resolver';
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
import type { Command } from 'commander';

// --- API response types aligned with real contracts ---

interface IAccountResponse {
  address: string;
  nonce?: number;
}

// /wallet/v1/account/token/search — POST, contractList is string[]
// Response: IFetchTokenDetailItem[] where each has { info: IToken }
interface ITokenDetailItem {
  info: {
    decimals: number;
    symbol: string;
    name: string;
    address: string;
  };
}

// /wallet/v1/account/estimate-fee — POST
// Response: IEstimateGasResp (flat structure, NOT nested under common)
interface IGasLegacy {
  gasPrice: string;
  gasLimit: string;
  gasLimitForDisplay?: string;
}

interface IGasEIP1559 {
  baseFeePerGas: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  gasLimit: string;
  gasLimitForDisplay?: string;
  gasPrice?: string;
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

// /wallet/v1/account/send-transaction — POST
// Response: { result: string } where result is the txid hash
interface ISendTransactionResult {
  result: string;
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
          const chainConfig = resolveChain(chainName);

          const { feeDecimals, nativeDecimals, nativeSymbol } = chainConfig;

          const signer = await getSignerByImpl(chainConfig.impl);
          const addressInfo = await signer.getAddress(chainConfig.networkId);
          const fromAddress = addressInfo.address;

          // Build encoded tx
          let encodedTx: Record<string, string>;
          if (validated.token) {
            // #2 fix: POST with contractList as array, read from resp[0].info
            const tokenResults = await apiClient.post<ITokenDetailItem[]>(
              'wallet',
              '/wallet/v1/account/token/search',
              {
                networkId: chainConfig.networkId,
                contractList: [validated.token],
              },
            );
            const tokenInfo = tokenResults?.[0]?.info;
            if (!tokenInfo || tokenInfo.decimals === undefined) {
              throw new AppError(
                ERROR_CODES.PARAM_INVALID_TOKEN.code,
                `Cannot resolve decimals for token ${validated.token}`,
                'Verify the token contract address is correct',
              );
            }
            // Validate address field is a non-empty string before calling toLowerCase()
            if (
              typeof tokenInfo.address !== 'string' ||
              tokenInfo.address.length === 0
            ) {
              throw new AppError(
                ERROR_CODES.PARAM_INVALID_TOKEN.code,
                `Token info is missing address field for ${validated.token}`,
                'Verify the token contract address is correct',
              );
            }
            // Guard against API returning a different token than requested
            if (
              tokenInfo.address.toLowerCase() !== validated.token.toLowerCase()
            ) {
              throw new AppError(
                ERROR_CODES.PARAM_INVALID_TOKEN.code,
                `Token address mismatch: expected ${validated.token}, got ${tokenInfo.address}`,
                'Verify the token contract address is correct',
              );
            }
            // Validate decimals is a safe integer in a reasonable ERC-20 range (0–77)
            if (
              !Number.isInteger(tokenInfo.decimals) ||
              tokenInfo.decimals < 0 ||
              tokenInfo.decimals > 77
            ) {
              throw new AppError(
                ERROR_CODES.PARAM_INVALID_TOKEN.code,
                `Token has invalid decimals value: ${tokenInfo.decimals}`,
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
              nativeDecimals,
            );
          }

          // #3 fix: estimate-fee response is flat IEstimateGasResp
          const feeResp = await apiClient.post<IEstimateGasResp>(
            'wallet',
            '/wallet/v1/account/estimate-fee',
            {
              networkId: chainConfig.networkId,
              accountAddress: fromAddress,
              encodedTx,
            },
          );

          // Verify decimals match chain config
          if (feeResp.feeDecimals !== feeDecimals) {
            throw new AppError(
              ERROR_CODES.BIZ_UNKNOWN.code,
              `feeDecimals mismatch: API=${feeResp.feeDecimals}, config=${feeDecimals}`,
              `Chain ${chainName} config may be outdated`,
            );
          }
          if (feeResp.nativeDecimals !== nativeDecimals) {
            throw new AppError(
              ERROR_CODES.BIZ_UNKNOWN.code,
              `nativeDecimals mismatch: API=${feeResp.nativeDecimals}, config=${nativeDecimals}`,
              `Chain ${chainName} config may be outdated`,
            );
          }

          // Parse gas from correct field based on isEIP1559
          const isEIP1559 = feeResp.isEIP1559;
          let gasLimit: string;
          let gasPriceDisplay: string;

          if (isEIP1559) {
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
            gasLimit = eipGas.gasLimit;
            gasPriceDisplay = eipGas.maxFeePerGas;
          } else {
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
            gasLimit = legacyGas.gasLimit;
            gasPriceDisplay = legacyGas.gasPrice;
          }

          const estimatedGasDisplay = estimateGasCostDisplay(
            gasLimit,
            gasPriceDisplay,
            feeDecimals,
            nativeSymbol,
            nativeDecimals,
          );
          if (estimatedGasDisplay.startsWith('unknown')) {
            throw new AppError(
              ERROR_CODES.BIZ_GAS_ESTIMATION_FAILED.code,
              'Gas cost estimation failed — cannot proceed safely',
              'API returned gas values that could not be computed',
            );
          }

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

          const chainId = chainConfig.networkId.split('--')[1];

          // Fetch nonce
          const accountInfo = await apiClient.get<IAccountResponse>(
            'wallet',
            '/wallet/v1/account/get-account',
            {
              networkId: chainConfig.networkId,
              accountAddress: fromAddress,
              withNonce: true,
            },
          );

          if (accountInfo.nonce === undefined || accountInfo.nonce === null) {
            throw new AppError(
              ERROR_CODES.NET_REQUEST_FAILED.code,
              'API did not return nonce (withNonce=true). Cannot sign safely.',
              'Check API connectivity or retry',
            );
          }
          if (
            !Number.isSafeInteger(accountInfo.nonce) ||
            accountInfo.nonce < 0
          ) {
            throw new AppError(
              ERROR_CODES.NET_REQUEST_FAILED.code,
              `API returned invalid nonce value: ${accountInfo.nonce}`,
              'Check API connectivity or retry',
            );
          }

          // Build complete encodedTx for signing
          // Gas prices from API are in feeDecimals units → convert to wei hex
          let encodedTxWithGas: Record<string, unknown>;
          if (isEIP1559) {
            const eipGas = feeResp.gasEIP1559?.[1] ?? feeResp.gasEIP1559?.[0];
            encodedTxWithGas = {
              ...encodedTx,
              nonce: accountInfo.nonce,
              chainId,
              gasLimit: eipGas!.gasLimit,
              maxFeePerGas: feeToWeiHex(eipGas!.maxFeePerGas, feeDecimals),
              maxPriorityFeePerGas: feeToWeiHex(
                eipGas!.maxPriorityFeePerGas,
                feeDecimals,
              ),
            };
          } else {
            const legacyGas = feeResp.gas?.[1] ?? feeResp.gas?.[0];
            encodedTxWithGas = {
              ...encodedTx,
              nonce: accountInfo.nonce,
              chainId,
              gasLimit: legacyGas!.gasLimit,
              gasPrice: feeToWeiHex(legacyGas!.gasPrice, feeDecimals),
            };
          }

          const signedTx = await signer.signTransaction({
            networkId: chainConfig.networkId,
            account: {
              address: fromAddress,
              path: addressInfo.path ?? "m/44'/60'/0'/0/0",
              pub: addressInfo.publicKey,
            },
            unsignedTx: { encodedTx: encodedTxWithGas },
          });

          // #4 fix: broadcast response has { result: txHashString }
          const broadcastResult = await apiClient.post<ISendTransactionResult>(
            'wallet',
            '/wallet/v1/account/send-transaction',
            {
              networkId: chainConfig.networkId,
              accountAddress: fromAddress,
              tx: signedTx.rawTx,
            },
          );

          const TX_HASH_PATTERN = /^0x[a-fA-F0-9]{64}$/;
          if (
            !broadcastResult?.result ||
            !TX_HASH_PATTERN.test(broadcastResult.result)
          ) {
            throw new AppError(
              ERROR_CODES.BIZ_TRANSACTION_FAILED.code,
              `Broadcast returned invalid txid: "${broadcastResult?.result ?? ''}"`,
              'Check the transaction on chain explorer manually',
            );
          }

          output.success(
            {
              txid: broadcastResult.result,
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
