import { randomUUID } from 'node:crypto';

import { sortSwapQuotes } from '@onekeyhq/shared/src/utils/swapQuoteSortUtils';
import type { IFetchQuoteResult } from '@onekeyhq/shared/types/swap/types';

import { ConfigManager } from '../../config';
import { auditToken, resolveToken, savePending } from '../../core';
import { resolveChain } from '../../core/chain-resolver';
import { AppError, ERROR_CODES } from '../../errors';
import { apiClient } from '../../infra';
import { getSignerByImpl } from '../../signer';
import {
  amountToSmallestUnit,
  validateAmountDecimals,
} from '../../utils/tx-utils';

import {
  formatRouteHeader,
  parseSortMode,
  renderQuoteTable,
} from './swap-display-utils';
import { fetchSwapNetworks } from './swap-networks';
import { getProtocolConfig } from './swap-protocol-config';
import { fetchQuotesViaSSE } from './swap-quote';

import type { IEndpointEnv } from '../../config';
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
  orderId?: string;
  [key: string]: unknown;
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
    .requiredOption('--chain <chain>', 'Target blockchain (e.g., eth, base)')
    .option(
      '--to-chain <chain>',
      'Destination chain for cross-chain bridge (default: same as --chain)',
    )
    .requiredOption(
      '--from <token>',
      'Source token (contract address or symbol)',
    )
    .requiredOption(
      '--to <token>',
      'Destination token (contract address or symbol)',
    )
    .requiredOption('--amount <amount>', 'Amount of source token to swap')
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
    .option('--force', 'Override high-risk token security check')
    .action(
      async (
        options: {
          chain: string;
          toChain?: string;
          from: string;
          to: string;
          amount: string;
          provider?: string;
          sort?: string;
          slippage?: string;
          force?: boolean;
        },
        command,
      ) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        const globalOpts = command.optsWithGlobals() as Record<string, unknown>;
        const output = globalOpts._outputFormatter as OutputFormatter;

        try {
          const chainConfig = resolveChain(options.chain);
          const toChainInput = options.toChain;
          const toChainConfig = toChainInput
            ? resolveChain(toChainInput)
            : chainConfig;
          const fromNetworkId = chainConfig.networkId;
          const toNetworkId = toChainConfig.networkId;
          const protocolConfig = getProtocolConfig(fromNetworkId, toNetworkId);

          // Validate chain supports swap
          const swapNetworks = await fetchSwapNetworks();
          if (swapNetworks.length > 0) {
            const isSwapSupported = swapNetworks.some(
              (n) => n.networkId === chainConfig.networkId,
            );
            if (!isSwapSupported) {
              throw new AppError(
                ERROR_CODES.PARAM_INVALID_CHAIN.code,
                `Chain "${options.chain}" does not support swap`,
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

          // Resolve both tokens
          const [fromResolved, toResolved] = await Promise.all([
            resolveToken(options.from, options.chain),
            resolveToken(options.to, toChainInput ?? options.chain),
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
              `Cannot determine valid decimals for ${options.from} (got: ${fromResolved.decimals})`,
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
              `Cannot determine valid decimals for ${options.to} (got: ${toResolved.decimals})`,
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
          if (!/^\d+(\.\d+)?$/.test(options.amount)) {
            throw new AppError(
              ERROR_CODES.PARAM_INVALID_AMOUNT.code,
              `Invalid amount: "${options.amount}"`,
              'Amount must be a positive decimal number (e.g., "100", "0.5")',
            );
          }

          // Validate amount decimal places against token decimals
          validateAmountDecimals(options.amount, fromResolved.decimals);

          const fromTokenAmountSmallest = amountToSmallestUnit(
            options.amount,
            fromResolved.decimals,
          );
          // The swap API expects human-readable amounts (e.g. "0.2"),
          // NOT smallest unit (e.g. "200000"). Use the raw user input.
          const fromTokenAmount = options.amount;

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

          // Wallet address is required for build-tx
          const walletAddress = await getWalletAddress(
            chainConfig.impl,
            chainConfig.networkId,
          );

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
            receivingAddress: walletAddress,
          };

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
            process.stderr.write(`\n${routeHeader}\n${table}\n\n`);
          }

          // Step 2: POST /swap/v1/build-tx with toTokenAmount from quote
          const buildTxResponse = await apiClient.post<IBuildTxResponse>(
            'swap',
            '/swap/v1/build-tx',
            {
              fromTokenAddress: fromResolved.contractAddress,
              toTokenAddress: toResolved.contractAddress,
              fromTokenAmount,
              toTokenAmount: matchedQuote.toAmount,
              fromNetworkId,
              toNetworkId,
              provider: matchedQuote.info.provider,
              userAddress: walletAddress,
              receivingAddress: walletAddress,
              slippagePercentage: slippage,
              protocol: 'Swap', // API uses 'Swap' for both swap and bridge
              kind: 'sell',
              quoteResultCtx: matchedQuote.quoteResultCtx,
            },
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
            fromTokenInfo.contractAddress.toLowerCase() !==
              fromResolved.contractAddress.toLowerCase()
          ) {
            throw new AppError(
              ERROR_CODES.BIZ_SWAP_FAILED.code,
              `Build-tx fromToken address mismatch: expected ${fromResolved.contractAddress || '(native)'}, got ${fromTokenInfo.contractAddress || '(native)'}`,
              'API returned data for a different token',
            );
          }
          if (
            toTokenInfo?.contractAddress !== undefined &&
            toTokenInfo.contractAddress.toLowerCase() !==
              toResolved.contractAddress.toLowerCase()
          ) {
            throw new AppError(
              ERROR_CODES.BIZ_SWAP_FAILED.code,
              `Build-tx toToken address mismatch: expected ${toResolved.contractAddress || '(native)'}, got ${toTokenInfo.contractAddress || '(native)'}`,
              'API returned data for a different token',
            );
          }

          // Validate tx data exists and is executable
          if (!buildTxResponse.tx || typeof buildTxResponse.tx !== 'object') {
            throw new AppError(
              ERROR_CODES.BIZ_SWAP_FAILED.code,
              'Build-tx API returned success but tx data is missing',
              'Try a different provider or amount',
            );
          }

          // Generate orderId and save pending order
          const orderId = randomUUID();
          const now = Date.now();

          savePending(orderId, {
            orderId,
            status: 'pending',
            chain: options.chain,
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
            amount: options.amount,
            txData: buildTxResponse as Record<string, unknown>,
            provider: matchedQuote.info.provider,
            allowanceResult:
              matchedQuote.allowanceResult ??
              buildTxResponse.result?.allowanceResult ??
              null,
          });

          output.success(
            {
              orderId,
              provider: matchedQuote.info.provider,
              providerName: matchedQuote.info.providerName,
              chain: options.chain,
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
              amount: options.amount,
              amountSmallestUnit: fromTokenAmountSmallest,
              slippage,
              walletAddress,
              hasTxData: buildTxResponse.tx !== undefined,
              allowanceResult:
                matchedQuote.allowanceResult ??
                buildTxResponse.result?.allowanceResult ??
                null,
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
