import { randomUUID } from 'node:crypto';

import { sortSwapQuotes } from '@onekeyhq/shared/src/utils/swapQuoteSortUtils';
import type { IFetchQuoteResult } from '@onekeyhq/shared/types/swap/types';

import { ConfigManager } from '../../config';
import { auditToken, resolveToken, savePending } from '../../core';
import { getBtcAddressTypeInfo } from '../../core/btc/address-types';
import {
  assertBtcSpendIsSafe,
  describeEncodedTxSpend,
} from '../../core/btc/spend-validation';
import { buildBtcTransferTx } from '../../core/btc/tx-builder';
import {
  assertChainCapability,
  isSolChain,
  resolveChain,
} from '../../core/chain-resolver';
import { AppError, ERROR_CODES } from '../../errors';
import { apiClient } from '../../infra';
import { getSignerByImpl } from '../../signer';
import { parseBtcFeeTier, resolveBtcFeeRate } from '../../utils/btc-fee-rate';
import {
  amountToSmallestUnit,
  validateAmountDecimals,
} from '../../utils/tx-utils';
import {
  requireAuthenticatedCommand,
  requireStringOption,
} from '../command-guards';

import {
  emptyBtcSwapAddressing,
  getBtcSwapAddressMetadata,
  hasBtcSwapAddressing,
  isBtcSwapChain,
  requireBtcSwapAddressType,
} from './swap-btc-address';
import {
  formatRouteHeader,
  parseSortMode,
  renderQuoteTable,
} from './swap-display-utils';
import { fetchSwapNetworks } from './swap-networks';
import { getProtocolConfig } from './swap-protocol-config';
import { fetchQuotesViaSSE } from './swap-quote';
import { tokenAddressMatchesForNetwork } from './swap-token-address';

import type { IEndpointEnv } from '../../config';
import type { BtcAddressType } from '../../core/btc/address-types';
import type { OutputFormatter } from '../../output';
import type { Command } from 'commander';

interface IBuildTxResultInfo {
  provider: string;
  providerName: string;
}

interface IBuildTxResult {
  info: IBuildTxResultInfo;
  allowanceResult?: {
    allowanceTarget: string;
    amount: string;
    shouldResetApprove?: boolean;
  };
  gasLimit?: number;
  fromTokenInfo?: { networkId?: string; contractAddress?: string };
  toTokenInfo?: { networkId?: string; contractAddress?: string };
  [key: string]: unknown;
}

interface IBuildTxResponse {
  result: IBuildTxResult;
  tx?: Record<string, unknown> | string;
  btcData?: {
    hexStr?: string;
    addressType?: unknown;
    [key: string]: unknown;
  };
  btcLocalTx?: Record<string, unknown>;
  // SOL aggregator response: `data` is the bs58-encoded VersionedTransaction.
  OKXTxObject?: {
    data?: string;
    [key: string]: unknown;
  };
  // Locally extracted SOL swap tx, populated in build to keep the order
  // self-contained (mirrors BTC's btcLocalTx).
  solSwapTx?: {
    encodedTx: string;
  };
  orderId?: string;
  [key: string]: unknown;
}

function hasValidEvmTx(response: IBuildTxResponse): boolean {
  return Boolean(response.tx && typeof response.tx === 'object');
}

function hasValidBtcData(response: IBuildTxResponse): boolean {
  const btcData = response.btcData;
  return Boolean(
    btcData &&
    typeof btcData === 'object' &&
    typeof btcData.hexStr === 'string' &&
    btcData.hexStr.length > 0 &&
    Array.isArray(btcData.addressType),
  );
}

function hasValidSolSwapTx(response: IBuildTxResponse): boolean {
  return (
    typeof response.solSwapTx?.encodedTx === 'string' &&
    response.solSwapTx.encodedTx.length > 0
  );
}

function amountFromSmallestUnit(value: string, decimals: number): string {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new AppError(
      ERROR_CODES.BIZ_SWAP_FAILED.code,
      `Invalid BTC provider amount: "${value}"`,
      'Try a different provider or amount',
    );
  }
  if (decimals === 0) return trimmed;
  const padded = trimmed.padStart(decimals + 1, '0');
  const integer = padded.slice(0, -decimals);
  const fraction = padded.slice(-decimals).replace(/0+$/, '');
  return fraction ? `${integer}.${fraction}` : integer;
}

function getObjectValue(
  value: unknown,
  key: string,
): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const nested = (value as Record<string, unknown>)[key];
  if (typeof nested !== 'object' || nested === null) return undefined;
  return nested as Record<string, unknown>;
}

function getStringValue(
  value: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const raw = value?.[key];
  return typeof raw === 'string' && raw.length > 0 ? raw : undefined;
}

function extractBtcProviderTransfer(
  response: IBuildTxResponse,
  nativeDecimals: number,
):
  | {
      toAddress: string;
      amount: string;
      opReturn?: string;
      source: 'thorSwapCallData' | 'changellyOrder' | 'swftOrder';
    }
  | undefined {
  const thorSwapCallData = getObjectValue(response, 'thorSwapCallData');
  const thorVault = getStringValue(thorSwapCallData, 'vault');
  const thorAmount = getStringValue(thorSwapCallData, 'amount');
  if (thorVault && thorAmount) {
    return {
      toAddress: thorVault,
      amount: amountFromSmallestUnit(thorAmount, nativeDecimals),
      opReturn:
        getStringValue(thorSwapCallData, 'memoStreamingSwap') ??
        getStringValue(thorSwapCallData, 'memo'),
      source: 'thorSwapCallData',
    };
  }

  const changellyOrder = getObjectValue(response, 'changellyOrder');
  const changellyPayinAddress = getStringValue(changellyOrder, 'payinAddress');
  const changellyAmount = getStringValue(changellyOrder, 'amountExpectedFrom');
  if (changellyPayinAddress && changellyAmount) {
    return {
      toAddress: changellyPayinAddress,
      amount: changellyAmount,
      opReturn: getStringValue(changellyOrder, 'payinExtraId'),
      source: 'changellyOrder',
    };
  }

  const swftOrder = getObjectValue(response, 'swftOrder');
  const swftPayinAddress = getStringValue(swftOrder, 'platformAddr');
  const swftAmount = getStringValue(swftOrder, 'depositCoinAmt');
  if (swftPayinAddress && swftAmount) {
    return {
      toAddress: swftPayinAddress,
      amount: swftAmount,
      opReturn: getStringValue(swftOrder, 'memo'),
      source: 'swftOrder',
    };
  }
}

function hasValidBtcLocalTx(response: IBuildTxResponse): boolean {
  const localTx = response.btcLocalTx;
  return Boolean(
    localTx &&
    typeof localTx === 'object' &&
    typeof localTx.encodedTx === 'object' &&
    localTx.encodedTx !== null &&
    typeof localTx.btcExtraInfo === 'object' &&
    localTx.btcExtraInfo !== null &&
    Array.isArray(localTx.relPaths),
  );
}

async function getWalletAddress(
  impl: string,
  networkId: string,
): Promise<string> {
  const signer = await getSignerByImpl(impl);
  const addressInfo = await signer.getAddress(networkId);
  return addressInfo.address;
}

export function registerSwapBuildCommand(parent: Command): void {
  parent
    .command('build')
    .description('Build an unsigned swap transaction')
    .option('--chain <chain>', 'Target blockchain (e.g., eth, base, required)')
    .option(
      '--to-chain <chain>',
      'Destination chain for cross-chain bridge (default: same as --chain)',
    )
    .option(
      '--from <token>',
      'Source token (contract address or symbol, required)',
    )
    .option(
      '--to <token>',
      'Destination token (contract address or symbol, required)',
    )
    .option('--amount <amount>', 'Amount of source token to swap (required)')
    .option(
      '--from-address-type <type>',
      'BTC source address type (taproot|native-segwit|nested-segwit|legacy)',
    )
    .option(
      '--to-address-type <type>',
      'BTC destination address type (taproot|native-segwit|nested-segwit|legacy)',
    )
    .option(
      '--provider <provider>',
      'Swap provider ID (auto-selected if omitted)',
    )
    .option(
      '--sort <mode>',
      'Sort providers: recommended (default), gas_fee, swap_duration, received',
      'recommended',
    )
    .option('--slippage <percent>', 'Slippage tolerance percentage')
    .option(
      '--fee-rate <satsPerVByte>',
      'BTC fee rate in sats/vByte (BTC source only); overrides --fee-tier',
    )
    .option(
      '--fee-tier <tier>',
      'BTC fee tier: slow | standard (default) | fast (BTC source only)',
    )
    .option('--force', 'Override high-risk token security check')
    .action(
      async (
        options: {
          chain?: string;
          toChain?: string;
          from?: string;
          to?: string;
          amount?: string;
          fromAddressType?: BtcAddressType;
          toAddressType?: BtcAddressType;
          provider?: string;
          sort?: string;
          slippage?: string;
          feeRate?: string;
          feeTier?: string;
          force?: boolean;
        },
        command,
      ) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        const globalOpts = command.optsWithGlobals() as Record<string, unknown>;
        const output = globalOpts._outputFormatter as OutputFormatter;

        try {
          await requireAuthenticatedCommand();

          const chain = requireStringOption(options.chain, '--chain <chain>');
          const from = requireStringOption(options.from, '--from <token>');
          const to = requireStringOption(options.to, '--to <token>');
          const amount = requireStringOption(
            options.amount,
            '--amount <amount>',
          );

          const chainConfig = resolveChain(chain);
          const toChainInput = options.toChain;
          const toChainConfig = toChainInput
            ? resolveChain(toChainInput)
            : chainConfig;
          assertChainCapability(chainConfig, 'swap', 'swap-build');
          assertChainCapability(toChainConfig, 'swap', 'swap-build');

          const fromNetworkId = chainConfig.networkId;
          const toNetworkId = toChainConfig.networkId;
          const protocolConfig = getProtocolConfig(fromNetworkId, toNetworkId);
          const btcAddressing = emptyBtcSwapAddressing();
          const fromBtcAddressType = isBtcSwapChain(chainConfig)
            ? requireBtcSwapAddressType(
                '--from-address-type',
                options.fromAddressType,
              )
            : undefined;
          const toBtcAddressType = isBtcSwapChain(toChainConfig)
            ? requireBtcSwapAddressType(
                '--to-address-type',
                options.toAddressType,
              )
            : undefined;

          // Validate chain supports swap
          const swapNetworks = await fetchSwapNetworks();
          if (swapNetworks.length > 0) {
            const isSwapSupported = swapNetworks.some(
              (n) => n.networkId === chainConfig.networkId,
            );
            if (!isSwapSupported) {
              throw new AppError(
                ERROR_CODES.PARAM_INVALID_CHAIN.code,
                `Chain "${chain}" does not support swap`,
                `Run 'onekey swap networks' to see supported chains.`,
              );
            }
          }

          if (fromNetworkId !== toNetworkId) {
            const networks = await fetchSwapNetworks();
            const fromNet = networks.find((n) => n.networkId === fromNetworkId);
            const toNet = networks.find((n) => n.networkId === toNetworkId);
            if (!fromNet?.supportCrossChainSwap) {
              throw new AppError(
                ERROR_CODES.PARAM_INVALID_CHAIN.code,
                `Network ${fromNetworkId} does not support cross-chain bridge`,
                'Run "onekey swap networks --bridge" to see supported networks',
              );
            }
            if (!toNet?.supportCrossChainSwap) {
              throw new AppError(
                ERROR_CODES.PARAM_INVALID_CHAIN.code,
                `Network ${toNetworkId} does not support cross-chain bridge`,
                'Run "onekey swap networks --bridge" to see supported networks',
              );
            }
          }

          if (fromBtcAddressType) {
            btcAddressing.from = await getBtcSwapAddressMetadata(
              chainConfig,
              fromBtcAddressType,
            );
          }

          if (toBtcAddressType) {
            btcAddressing.to = await getBtcSwapAddressMetadata(
              toChainConfig,
              toBtcAddressType,
            );
          }

          // Resolve both tokens
          const [fromResolved, toResolved] = await Promise.all([
            resolveToken(from, chain),
            resolveToken(to, toChainInput ?? chain),
          ]);

          // fromToken decimals must be known and valid — no default allowed
          if (
            fromResolved.decimals === null ||
            !Number.isInteger(fromResolved.decimals) ||
            fromResolved.decimals < 0 ||
            fromResolved.decimals > 77
          ) {
            throw new AppError(
              ERROR_CODES.PARAM_INVALID_TOKEN.code,
              `Cannot determine valid decimals for ${from} (got: ${fromResolved.decimals})`,
              'Use contract address instead of symbol, or verify the token exists',
            );
          }

          // toToken decimals must also be known for pending storage
          if (
            toResolved.decimals === null ||
            !Number.isInteger(toResolved.decimals) ||
            toResolved.decimals < 0 ||
            toResolved.decimals > 77
          ) {
            throw new AppError(
              ERROR_CODES.PARAM_INVALID_TOKEN.code,
              `Cannot determine valid decimals for ${to} (got: ${toResolved.decimals})`,
              'Use contract address instead of symbol, or verify the token exists',
            );
          }

          // Security audit on toToken — use toNetworkId (token is on dest chain)
          if (toResolved.contractAddress) {
            const audit = await auditToken(
              toNetworkId,
              toResolved.contractAddress,
            );
            if (audit.isHighRisk && !options.force) {
              throw new AppError(
                ERROR_CODES.SEC_HIGH_RISK_TOKEN.code,
                `Token ${toResolved.symbol} is flagged as high risk: ${audit.riskItems.join(', ')}`,
                'Use --force to override the security check',
              );
            }
          }

          // Validate amount is a valid positive decimal number
          if (!/^\d+(\.\d+)?$/.test(amount)) {
            throw new AppError(
              ERROR_CODES.PARAM_INVALID_AMOUNT.code,
              `Invalid amount: "${amount}"`,
              'Amount must be a positive decimal number (e.g., "100", "0.5")',
            );
          }

          // Validate amount decimal places against token decimals
          validateAmountDecimals(amount, fromResolved.decimals);

          const fromTokenAmountSmallest = amountToSmallestUnit(
            amount,
            fromResolved.decimals,
          );
          // The swap API expects human-readable amounts (e.g. "0.2"),
          // NOT smallest unit (e.g. "200000"). Use the raw user input.
          const fromTokenAmount = amount;

          // Reject zero-value amounts
          if (fromTokenAmountSmallest === '0') {
            throw new AppError(
              ERROR_CODES.PARAM_INVALID_AMOUNT.code,
              'Amount must be greater than zero',
              'Provide a positive amount to swap',
            );
          }

          // Read slippage: CLI flag > config > default
          const config = await new ConfigManager().getConfig();
          let slippage: number;
          if (options.slippage !== undefined) {
            slippage = Number(options.slippage);
            if (Number.isNaN(slippage) || slippage < 0.05 || slippage > 50) {
              throw new AppError(
                ERROR_CODES.PARAM_INVALID_SLIPPAGE.code,
                `Invalid slippage: ${options.slippage} (must be 0.05–50)`,
                'Use a value between 0.05 and 50',
              );
            }
          } else {
            slippage = config.default_slippage;
          }

          // Source wallet address is required for build-tx.
          const walletAddress = btcAddressing.from
            ? btcAddressing.from.address
            : await getWalletAddress(chainConfig.impl, chainConfig.networkId);
          // Receiving address must belong to the destination chain's address
          // system. Reusing the source walletAddress is only safe when source
          // and destination share the same impl (e.g. both EVM). For any
          // cross-impl route (BTC<->X, EVM<->SOL, etc.) derive from
          // toChainConfig so we never hand the aggregator an EVM address for
          // SOL (or vice versa) and end up with funds routed to a
          // never-controlled key.
          const isCrossImplRoute = chainConfig.impl !== toChainConfig.impl;
          const receivingAddress =
            btcAddressing.to?.address ??
            (isCrossImplRoute
              ? await getWalletAddress(
                  toChainConfig.impl,
                  toChainConfig.networkId,
                )
              : walletAddress);

          // Resolve env
          const env = (
            (globalOpts.env as string) === 'prod' ? 'prod' : 'test'
          ) as IEndpointEnv;
          apiClient.setEnv(env);

          // Step 1: Internal quote to get toTokenAmount and validate provider
          const quoteParams: Record<string, string | number> = {
            fromTokenAddress: fromResolved.contractAddress,
            toTokenAddress: toResolved.contractAddress,
            fromTokenAmount,
            fromNetworkId,
            toNetworkId,
            slippagePercentage: slippage,
            protocol: 'Swap', // API uses 'Swap' for both swap and bridge
            kind: 'sell',
            userAddress: walletAddress,
          };
          if (receivingAddress) {
            quoteParams.receivingAddress = receivingAddress;
          }

          const quotes = await fetchQuotesViaSSE(env, quoteParams);
          const sortMode = parseSortMode(options.sort);
          const sortedQuotes = sortSwapQuotes(quotes, {
            sort: sortMode,
            fromTokenAmount,
          });

          let matchedQuote: IFetchQuoteResult | undefined;
          if (options.provider) {
            // Manual provider override
            matchedQuote = sortedQuotes.find(
              (q) =>
                q.info.provider.toLowerCase() ===
                  options.provider!.toLowerCase() && q.toAmount,
            );
            if (!matchedQuote) {
              const available = sortedQuotes
                .filter((q) => q.toAmount)
                .map((q) => q.info.provider);
              throw new AppError(
                ERROR_CODES.BIZ_SWAP_FAILED.code,
                `Provider "${options.provider}" not available for this pair`,
                available.length > 0
                  ? `Available providers: ${available.join(', ')}`
                  : 'No providers returned quotes for this pair',
              );
            }
          } else {
            // Auto-select best provider
            matchedQuote = sortedQuotes.find((q) => q.toAmount);
            if (!matchedQuote) {
              throw new AppError(
                ERROR_CODES.BIZ_SWAP_FAILED.code,
                'No provider returned a usable quote',
                'Try a different token pair, amount, or slippage',
              );
            }
          }

          // Render table with selected marker to stderr
          const fromName =
            swapNetworks.find((n) => n.networkId === fromNetworkId)?.name ??
            fromNetworkId;
          const toName =
            swapNetworks.find((n) => n.networkId === toNetworkId)?.name ??
            toNetworkId;
          const routeHeader = formatRouteHeader(fromName, toName);
          const table = renderQuoteTable(
            sortedQuotes,
            toResolved.symbol,
            matchedQuote.info.provider,
          );
          if (output.getMode() === 'human') {
            output.raw(`\n${routeHeader}\n${table}\n\n`, 'stderr');
          }

          // Step 2: POST /swap/v1/build-tx with toTokenAmount from quote
          const buildTxParams: Record<string, unknown> = {
            fromTokenAddress: fromResolved.contractAddress,
            toTokenAddress: toResolved.contractAddress,
            fromTokenAmount,
            toTokenAmount: matchedQuote.toAmount,
            fromNetworkId,
            toNetworkId,
            provider: matchedQuote.info.provider,
            userAddress: walletAddress,
            slippagePercentage: slippage,
            protocol: 'Swap', // API uses 'Swap' for both swap and bridge
            kind: 'sell',
            quoteResultCtx: matchedQuote.quoteResultCtx,
          };
          if (receivingAddress) {
            buildTxParams.receivingAddress = receivingAddress;
          }

          const buildTxResponse = await apiClient.post<IBuildTxResponse>(
            'swap',
            '/swap/v1/build-tx',
            buildTxParams,
          );

          // Validate build-tx response contains usable result
          if (
            !buildTxResponse.result ||
            typeof buildTxResponse.result !== 'object' ||
            !buildTxResponse.result.info ||
            typeof buildTxResponse.result.info.provider !== 'string'
          ) {
            throw new AppError(
              ERROR_CODES.BIZ_SWAP_FAILED.code,
              'Build-tx returned no usable result (missing result.info.provider)',
              'Try a different provider or check token pair availability',
            );
          }

          // Validate response provider matches request
          const selectedProvider = matchedQuote.info.provider;
          const resultProvider = buildTxResponse.result.info.provider;
          if (resultProvider.toLowerCase() !== selectedProvider.toLowerCase()) {
            throw new AppError(
              ERROR_CODES.BIZ_SWAP_FAILED.code,
              `Build-tx provider mismatch: requested "${selectedProvider}", got "${resultProvider}"`,
              'API returned data for a different provider',
            );
          }

          // Validate response token info matches request (if present)
          const { fromTokenInfo, toTokenInfo } = buildTxResponse.result;
          if (
            fromTokenInfo?.networkId &&
            fromTokenInfo.networkId !== fromResolved.networkId
          ) {
            throw new AppError(
              ERROR_CODES.BIZ_SWAP_FAILED.code,
              `Build-tx fromToken networkId mismatch: expected ${fromResolved.networkId}, got ${fromTokenInfo.networkId}`,
              'API returned data for a different token pair',
            );
          }
          if (
            toTokenInfo?.networkId &&
            toTokenInfo.networkId !== toResolved.networkId
          ) {
            throw new AppError(
              ERROR_CODES.BIZ_SWAP_FAILED.code,
              `Build-tx toToken networkId mismatch: expected ${toResolved.networkId}, got ${toTokenInfo.networkId}`,
              'API returned data for a different token pair',
            );
          }
          if (
            fromTokenInfo?.contractAddress !== undefined &&
            !tokenAddressMatchesForNetwork(
              fromResolved.networkId,
              fromTokenInfo.contractAddress,
              fromResolved.contractAddress,
            )
          ) {
            throw new AppError(
              ERROR_CODES.BIZ_SWAP_FAILED.code,
              `Build-tx fromToken address mismatch: expected ${fromResolved.contractAddress || '(native)'}, got ${fromTokenInfo.contractAddress || '(native)'}`,
              'API returned data for a different token',
            );
          }
          if (
            toTokenInfo?.contractAddress !== undefined &&
            !tokenAddressMatchesForNetwork(
              toResolved.networkId,
              toTokenInfo.contractAddress,
              toResolved.contractAddress,
            )
          ) {
            throw new AppError(
              ERROR_CODES.BIZ_SWAP_FAILED.code,
              `Build-tx toToken address mismatch: expected ${toResolved.contractAddress || '(native)'}, got ${toTokenInfo.contractAddress || '(native)'}`,
              'API returned data for a different token',
            );
          }

          // Validate executable data exists. EVM source routes require tx;
          // BTC source routes may return PSBT data under btcData, or App-style
          // provider deposit data that must be converted into a local BTC tx.
          // A bare `tx` payload is NOT executable on the BTC execute branch,
          // so we ignore it here and rely on the final hasTxData gate to fail
          // closed if neither btcData nor a provider transfer is available.
          const isBtcSource = Boolean(btcAddressing.from);
          if (
            isBtcSource &&
            !hasValidBtcData(buildTxResponse) &&
            btcAddressing.from
          ) {
            const transfer = extractBtcProviderTransfer(
              buildTxResponse,
              fromResolved.decimals,
            );
            if (transfer) {
              // Provider deposit amount MUST match the user-input swap amount.
              // Without this guard, a malicious or buggy build-tx response can
              // silently inflate the BTC sent on chain.
              const providerAmountSmallest = amountToSmallestUnit(
                transfer.amount,
                fromResolved.decimals,
              );
              if (providerAmountSmallest !== fromTokenAmountSmallest) {
                throw new AppError(
                  ERROR_CODES.BIZ_SWAP_FAILED.code,
                  `Provider deposit amount mismatch (${transfer.source}): expected ${amount}, provider asked for ${transfer.amount}`,
                  'Refresh the quote or report a provider/API issue — refusing to build the BTC tx',
                );
              }

              const addressTypeInfo = getBtcAddressTypeInfo(
                chainConfig.impl,
                btcAddressing.from.addressType,
              );
              const btcFeeRate = await resolveBtcFeeRate({
                impl: chainConfig.impl,
                networkId: chainConfig.networkId,
                accountAddress: btcAddressing.from.address,
                explicitFeeRate: options.feeRate,
                tier: parseBtcFeeTier(options.feeTier),
              });
              const builtLocalTx = await buildBtcTransferTx({
                impl: chainConfig.impl,
                networkId: chainConfig.networkId,
                fromAddress: btcAddressing.from.address,
                fromPath: btcAddressing.from.path,
                toAddress: transfer.toAddress,
                amount: transfer.amount,
                nativeDecimals: fromResolved.decimals,
                feeRate: btcFeeRate,
                addressTypeInfo,
                opReturn: transfer.opReturn,
              });

              // Independent spend validation — even though we just built this
              // tx locally, run the same guardrail used at execute-time so
              // both paths fail closed against the same invariants.
              assertBtcSpendIsSafe(
                describeEncodedTxSpend(
                  builtLocalTx.encodedTx,
                  btcAddressing.from.address,
                ),
                { expectedSpendSats: BigInt(fromTokenAmountSmallest) },
              );

              buildTxResponse.btcLocalTx = {
                encodedTx: builtLocalTx.encodedTx,
                btcExtraInfo: builtLocalTx.btcExtraInfo,
                relPaths: builtLocalTx.relPaths,
                summary: builtLocalTx.summary,
                transfer,
                feeRate: btcFeeRate,
              };
            }
          }

          // SOL swap = passthrough of OKXTxObject.data; persist it on the order
          // so execute does not need to know about OKXTxObject.
          const isSolSource = isSolChain(chainConfig);
          if (isSolSource && !hasValidSolSwapTx(buildTxResponse)) {
            const okxData = buildTxResponse.OKXTxObject?.data;
            if (typeof okxData === 'string' && okxData.length > 0) {
              buildTxResponse.solSwapTx = { encodedTx: okxData };
            }
          }

          // BTC source routes MUST sign a BTC PSBT — an EVM-style `tx` payload
          // cannot be signed on this code path, so we reject it at build time
          // instead of saving a pending order that execute will fail to sign.
          let hasTxData: boolean;
          if (isBtcSource) {
            hasTxData =
              hasValidBtcData(buildTxResponse) ||
              hasValidBtcLocalTx(buildTxResponse);
          } else if (isSolSource) {
            hasTxData = hasValidSolSwapTx(buildTxResponse);
          } else {
            hasTxData = hasValidEvmTx(buildTxResponse);
          }

          if (!hasTxData) {
            let message: string;
            if (isBtcSource) {
              if (hasValidEvmTx(buildTxResponse)) {
                message =
                  'Build-tx API returned an EVM-style tx for a BTC source route; this provider/route is not supported';
              } else {
                message =
                  'Build-tx API returned success but no BTC PSBT or provider deposit data is available';
              }
            } else if (isSolSource) {
              message =
                'Build-tx API returned success but no SOL swap tx data is available';
            } else {
              message = 'Build-tx API returned success but tx data is missing';
            }
            throw new AppError(
              ERROR_CODES.BIZ_SWAP_FAILED.code,
              message,
              'Try a different provider or amount',
            );
          }

          // Generate orderId and save pending order
          const orderId = randomUUID();
          const now = Date.now();
          const pendingBtcAddressing = hasBtcSwapAddressing(btcAddressing)
            ? btcAddressing
            : undefined;

          savePending(orderId, {
            orderId,
            status: 'pending',
            chain,
            networkId: chainConfig.networkId,
            toNetworkId,
            protocolType: protocolConfig.protocol,
            createdAt: now,
            updatedAt: now,
            fromToken: {
              contractAddress: fromResolved.contractAddress,
              symbol: fromResolved.symbol,
              decimals: fromResolved.decimals,
            },
            toToken: {
              contractAddress: toResolved.contractAddress,
              symbol: toResolved.symbol,
              decimals: toResolved.decimals,
            },
            amount,
            txData: buildTxResponse as Record<string, unknown>,
            provider: matchedQuote.info.provider,
            allowanceResult:
              matchedQuote.allowanceResult ??
              buildTxResponse.result?.allowanceResult ??
              null,
            ...(pendingBtcAddressing
              ? { btcAddressing: pendingBtcAddressing }
              : {}),
          });

          output.success(
            {
              orderId,
              provider: matchedQuote.info.provider,
              providerName: matchedQuote.info.providerName,
              chain,
              from: {
                symbol: fromResolved.symbol,
                contractAddress: fromResolved.contractAddress,
                decimals: fromResolved.decimals,
              },
              to: {
                symbol: toResolved.symbol,
                contractAddress: toResolved.contractAddress,
                decimals: toResolved.decimals,
              },
              amount,
              amountSmallestUnit: fromTokenAmountSmallest,
              slippage,
              walletAddress,
              hasTxData,
              allowanceResult:
                matchedQuote.allowanceResult ??
                buildTxResponse.result?.allowanceResult ??
                null,
              btcAddressing,
            },
            { chain },
          );
        } catch (error) {
          const appError = AppError.from(error);
          output.error(appError.toErrorDetail());
          process.exitCode = appError.exitCode;
        }
      },
    );
}
