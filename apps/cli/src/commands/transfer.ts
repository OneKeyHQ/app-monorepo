import {
  SOL_TXID_PATTERN,
  assertAddressForChain,
  assertTokenAddressForChain,
} from '../core/address-utils';
import {
  BTC_ADDRESS_TYPES,
  getBtcAddressTypeInfo,
  isBtcImpl,
} from '../core/btc/address-types';
import { buildBtcTransferTx } from '../core/btc/tx-builder';
import {
  assertChainCapability,
  isEvmChain,
  isSolChain,
  resolveChain,
} from '../core/chain-resolver';
import { buildSolTransferTx } from '../core/sol/tx-builder';
import { AppError, ERROR_CODES } from '../errors';
import { apiClient } from '../infra';
import { transferOptionsSchema } from '../schemas';
import { getSignerByImpl } from '../signer';
import { resolveSolPath } from '../signer/impls/sol/sol-path';
import { parseBtcFeeTier, resolveBtcFeeRate } from '../utils/btc-fee-rate';
import { confirmTransaction } from '../utils/confirm-transaction';
import {
  buildErc20EncodedTx,
  buildNativeEncodedTx,
  estimateGasCostDisplay,
  feeToWeiHex,
  validateAmountDecimals,
} from '../utils/tx-utils';

import {
  requireAuthenticatedCommand,
  requireStringOption,
} from './command-guards';

import type { BtcAddressType } from '../core/btc/address-types';
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
    .option('--to <address>', 'Recipient address (required)')
    .option('--amount <amount>', 'Amount to send (human-readable, required)')
    .option('--token <address>', 'ERC-20 token contract address')
    .option('--chain <chain>', 'Target blockchain (e.g., eth, bsc)', 'eth')
    .option(
      '--address-type <type>',
      `BTC/TBTC sender address type (${BTC_ADDRESS_TYPES.join('|')})`,
    )
    .option(
      '--fee-rate <satsPerVByte>',
      'BTC fee rate in sats/vByte; overrides --fee-tier',
    )
    .option(
      '--fee-tier <tier>',
      'BTC fee tier: slow | standard (default) | fast',
    )
    .option('--dry-run', 'Estimate fees without sending')
    .action(
      async (
        options: {
          to?: string;
          amount?: string;
          token?: string;
          chain: string;
          addressType?: BtcAddressType;
          feeRate?: string;
          feeTier?: string;
          dryRun?: boolean;
        },
        command,
      ) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        const globalOpts = command.optsWithGlobals() as Record<string, unknown>;
        const output = globalOpts._outputFormatter as OutputFormatter;
        const skipConfirmation = Boolean(globalOpts.yes);

        try {
          await requireAuthenticatedCommand();

          const to = requireStringOption(options.to, '--to <address>');
          const amount = requireStringOption(
            options.amount,
            '--amount <amount>',
          );

          const validated = transferOptionsSchema.parse({
            to,
            amount,
            token: options.token,
            chain: options.chain,
            addressType: options.addressType,
            feeRate: options.feeRate,
            feeTier: options.feeTier,
            dryRun: options.dryRun,
            yes: skipConfirmation,
          });

          const chainName = validated.chain ?? 'eth';
          const chainConfig = resolveChain(chainName);

          // Fail-fast token format check. The schema is intentionally
          // chain-agnostic (EVM contract address, SPL mint, etc.), so the
          // strict per-chain validation happens here — before signer / auth
          // work, otherwise a bad --token surfaces as AUTH_NO_WALLET.
          // BTC has a native-only constraint enforced later in its branch
          // with a clearer error; skip here.
          const validatedToken =
            validated.token && !isBtcImpl(chainConfig.impl)
              ? assertTokenAddressForChain(chainConfig, validated.token)
              : validated.token;

          if (isSolChain(chainConfig)) {
            assertChainCapability(chainConfig, 'solTransfer', 'transfer');

            if (validated.addressType) {
              throw new AppError(
                ERROR_CODES.PARAM_INVALID_COMMAND.code,
                '--address-type is BTC-only; not applicable to SOL.',
                'Drop --address-type for SOL transfers.',
              );
            }

            const signer = await getSignerByImpl(chainConfig.impl);
            const addressInfo = await signer.getAddress(chainConfig.networkId);
            const fromAddress = addressInfo.address;
            const toAddress = assertAddressForChain(chainConfig, validated.to);

            // Resolve token decimals + canonical mint address. For native SOL
            // (no --token) the chain config provides the decimals; for SPL we
            // hit the same /wallet/v1/account/token/search endpoint EVM uses.
            let tokenDecimals = chainConfig.nativeDecimals;
            let tokenMint: string | undefined;
            let tokenSymbol = chainConfig.nativeSymbol;
            if (validatedToken) {
              const splMint = validatedToken;
              const tokenResults = await apiClient.post<ITokenDetailItem[]>(
                'wallet',
                '/wallet/v1/account/token/search',
                {
                  networkId: chainConfig.networkId,
                  contractList: [splMint],
                },
              );
              const tokenInfo = tokenResults?.[0]?.info;
              if (
                !tokenInfo ||
                tokenInfo.decimals === undefined ||
                typeof tokenInfo.address !== 'string' ||
                tokenInfo.address.length === 0
              ) {
                throw new AppError(
                  ERROR_CODES.PARAM_INVALID_TOKEN.code,
                  `Cannot resolve SPL token ${validated.token}`,
                  'Verify the SPL mint address is correct.',
                );
              }
              // SPL mints are case-sensitive (base58) — strict equality only.
              if (tokenInfo.address !== splMint) {
                throw new AppError(
                  ERROR_CODES.PARAM_INVALID_TOKEN.code,
                  `Token address mismatch: expected ${splMint}, got ${tokenInfo.address}`,
                  'Verify the SPL mint address is correct.',
                );
              }
              if (
                !Number.isInteger(tokenInfo.decimals) ||
                tokenInfo.decimals < 0 ||
                tokenInfo.decimals > 18
              ) {
                throw new AppError(
                  ERROR_CODES.PARAM_INVALID_TOKEN.code,
                  `SPL token has invalid decimals: ${tokenInfo.decimals}`,
                  'Verify the SPL mint metadata.',
                );
              }
              tokenDecimals = tokenInfo.decimals;
              tokenMint = tokenInfo.address;
              tokenSymbol = tokenInfo.symbol || 'SPL';
            }

            validateAmountDecimals(validated.amount, tokenDecimals);

            const built = await buildSolTransferTx({
              networkId: chainConfig.networkId,
              fromAddress,
              toAddress,
              amount: validated.amount,
              decimals: tokenDecimals,
              tokenAddress: tokenMint,
            });

            if (validated.dryRun) {
              output.success({
                chain: chainName,
                from: fromAddress,
                to: toAddress,
                amount: validated.amount,
                token: tokenMint ?? 'native',
                symbol: tokenSymbol,
                ...(built.ataDetails
                  ? { createsAssociatedTokenAccount: built.ataDetails }
                  : {}),
                dryRun: true,
              });
              return;
            }

            await confirmTransaction({
              info: {
                action: tokenMint
                  ? `Transfer ${validated.amount} ${tokenSymbol}`
                  : `Transfer ${validated.amount} SOL`,
                to: toAddress,
                value: validated.amount,
                network: chainName,
                ...(built.ataDetails
                  ? {
                      estimatedGas:
                        'Includes Associated Token Account creation (sender pays rent)',
                    }
                  : {}),
              },
              output,
              skipConfirmation,
            });

            const signedTx = await signer.signTransaction({
              networkId: chainConfig.networkId,
              account: {
                address: fromAddress,
                path: addressInfo.path ?? resolveSolPath(0),
                pub: addressInfo.publicKey,
              },
              unsignedTx: {
                encodedTx: built.encodedTx as unknown as Record<
                  string,
                  unknown
                >,
                ...(built.ataDetails
                  ? { payload: { ataDetails: built.ataDetails } }
                  : {}),
              } as unknown as { encodedTx: Record<string, unknown> },
            });

            const broadcastResult =
              await apiClient.post<ISendTransactionResult>(
                'wallet',
                '/wallet/v1/account/send-transaction',
                {
                  networkId: chainConfig.networkId,
                  accountAddress: fromAddress,
                  tx: signedTx.rawTx,
                },
              );

            if (
              !broadcastResult?.result ||
              !SOL_TXID_PATTERN.test(broadcastResult.result)
            ) {
              throw new AppError(
                ERROR_CODES.BIZ_TRANSACTION_FAILED.code,
                `Broadcast returned invalid SOL txid: "${broadcastResult?.result ?? ''}"`,
                'Check the transaction on a SOL explorer manually.',
              );
            }

            output.success(
              {
                txid: broadcastResult.result,
                from: fromAddress,
                to: toAddress,
                amount: validated.amount,
                chain: chainName,
                token: tokenMint ?? 'native',
                symbol: tokenSymbol,
              },
              { chain: chainName },
            );
            return;
          }

          if (!isEvmChain(chainConfig)) {
            assertChainCapability(chainConfig, 'btcTransfer', 'transfer');

            if (!isBtcImpl(chainConfig.impl)) {
              assertChainCapability(chainConfig, 'evmTransfer', 'transfer');
            }

            if (!validated.addressType) {
              throw new AppError(
                ERROR_CODES.PARAM_MISSING_REQUIRED.code,
                'Missing required option --address-type for BTC/TBTC transfer.',
                `Use one of: ${BTC_ADDRESS_TYPES.join('|')}.`,
              );
            }

            if (validated.token) {
              throw new AppError(
                ERROR_CODES.PARAM_INVALID_TOKEN.code,
                'BTC/TBTC transfer supports native token only.',
                'Remove --token and send native BTC/TBTC.',
              );
            }

            const addressTypeInfo = getBtcAddressTypeInfo(
              chainConfig.impl,
              validated.addressType,
            );
            const signer = await getSignerByImpl(chainConfig.impl);
            const addressInfo = await signer.getAddress(chainConfig.networkId, {
              addressType: validated.addressType,
            });
            const fromAddress = addressInfo.address;
            const fromPath = addressTypeInfo.path;
            const fromAccountPath = addressTypeInfo.accountPath;
            const toAddress = assertAddressForChain(chainConfig, validated.to);
            const feeRate = await resolveBtcFeeRate({
              impl: chainConfig.impl,
              networkId: chainConfig.networkId,
              accountAddress: fromAddress,
              explicitFeeRate: validated.feeRate,
              tier: parseBtcFeeTier(validated.feeTier),
            });
            const builtTx = await buildBtcTransferTx({
              impl: chainConfig.impl,
              networkId: chainConfig.networkId,
              fromAddress,
              fromPath,
              toAddress,
              amount: validated.amount,
              nativeDecimals: chainConfig.nativeDecimals,
              feeRate,
              addressTypeInfo,
            });

            if (validated.dryRun) {
              output.success({
                chain: chainName,
                addressType: addressTypeInfo.addressType,
                from: fromAddress,
                to: toAddress,
                amount: validated.amount,
                fee: builtTx.summary.fee,
                feeRate,
                txSize: builtTx.summary.txSize,
                inputCount: builtTx.summary.inputCount,
                outputCount: builtTx.summary.outputCount,
                dryRun: true,
              });
              return;
            }

            await confirmTransaction({
              info: {
                action: `Transfer ${validated.amount} ${chainConfig.nativeSymbol}`,
                to: toAddress,
                value: validated.amount,
                network: chainName,
                estimatedGas: `${builtTx.summary.fee} sats @ ${feeRate} sat/vB`,
              },
              output,
              skipConfirmation,
            });

            const signedTx = await signer.signTransaction({
              networkId: chainConfig.networkId,
              account: {
                address: fromAddress,
                path: fromAccountPath,
                pub: addressInfo.publicKey,
              },
              unsignedTx: { encodedTx: builtTx.encodedTx },
              btcExtraInfo: builtTx.btcExtraInfo,
              relPaths: builtTx.relPaths,
              addressType: addressTypeInfo.addressType,
            });

            const broadcastResult =
              await apiClient.post<ISendTransactionResult>(
                'wallet',
                '/wallet/v1/account/send-transaction',
                {
                  networkId: chainConfig.networkId,
                  accountAddress: fromAddress,
                  tx: signedTx.rawTx,
                },
              );

            const BTC_TX_HASH_PATTERN = /^[a-fA-F0-9]{64}$/;
            if (
              !broadcastResult?.result ||
              !BTC_TX_HASH_PATTERN.test(broadcastResult.result)
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
                to: toAddress,
                amount: validated.amount,
                chain: chainName,
                addressType: addressTypeInfo.addressType,
              },
              { chain: chainName },
            );
            return;
          }

          assertChainCapability(chainConfig, 'evmTransfer', 'transfer');
          const toAddress = assertAddressForChain(chainConfig, validated.to);

          const { feeDecimals, nativeDecimals, nativeSymbol } = chainConfig;

          const signer = await getSignerByImpl(chainConfig.impl);
          const addressInfo = await signer.getAddress(chainConfig.networkId);
          const fromAddress = addressInfo.address;

          // Build encoded tx
          let encodedTx: Record<string, string>;
          if (validatedToken) {
            const erc20Address = validatedToken;
            // #2 fix: POST with contractList as array, read from resp[0].info
            const tokenResults = await apiClient.post<ITokenDetailItem[]>(
              'wallet',
              '/wallet/v1/account/token/search',
              {
                networkId: chainConfig.networkId,
                contractList: [erc20Address],
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
              tokenInfo.address.toLowerCase() !== erc20Address.toLowerCase()
            ) {
              throw new AppError(
                ERROR_CODES.PARAM_INVALID_TOKEN.code,
                `Token address mismatch: expected ${erc20Address}, got ${tokenInfo.address}`,
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
              toAddress,
              validated.amount,
              erc20Address,
              tokenInfo.decimals,
            );
          } else {
            validateAmountDecimals(validated.amount, nativeDecimals);
            encodedTx = buildNativeEncodedTx(
              fromAddress,
              toAddress,
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
              to: toAddress,
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
              to: toAddress,
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
              to: toAddress,
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
