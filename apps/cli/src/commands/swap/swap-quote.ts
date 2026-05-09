import { withCustomUAHeaders } from '@onekeyhq/shared/src/request/customUA';
import { sortSwapQuotes } from '@onekeyhq/shared/src/utils/swapQuoteSortUtils';
import type { IFetchQuoteResult } from '@onekeyhq/shared/types/swap/types';

import { ConfigManager, getHost } from '../../config';
import { auditToken, resolveToken } from '../../core';
import { assertChainCapability, resolveChain } from '../../core/chain-resolver';
import { AppError, ERROR_CODES } from '../../errors';
import { buildCliAppRequestHeaders } from '../../infra/app-request-headers';
import { getSignerByImpl } from '../../signer';
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

import type { IEndpointEnv } from '../../config';
import type { IAuditSummary } from '../../core';
import type { BtcAddressType } from '../../core/btc/address-types';
import type { OutputFormatter } from '../../output';
import type { Command } from 'commander';

/** SSE event data types — aligned with ISwapQuoteEventData */
interface ISseEventInfo {
  totalQuoteCount: number;
  eventId: string;
}

type ISseQuoteItem = Omit<
  IFetchQuoteResult,
  'fromTokenInfo' | 'toTokenInfo'
> & {
  eventId?: string;
  fromTokenInfo?: IFetchQuoteResult['fromTokenInfo'];
  toTokenInfo?: IFetchQuoteResult['toTokenInfo'];
};

interface ISseEventQuoteResult {
  data: ISseQuoteItem[];
}

interface ISseEventError {
  errorMessage?: string;
  eventId?: string;
}

const SSE_TIMEOUT_MS = 30_000;

function safeParse(jsonStr: string): unknown {
  try {
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

function computeOverallRisk(audit: IAuditSummary): 'high' | 'caution' | 'low' {
  if (audit.isHighRisk) return 'high';
  if (audit.cautionItems.length > 0) return 'caution';
  return 'low';
}

function isValidQuoteItem(v: unknown): v is IFetchQuoteResult {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  if (typeof r.info !== 'object' || r.info === null) return false;
  const info = r.info as Record<string, unknown>;
  return (
    typeof info.provider === 'string' && typeof info.providerName === 'string'
  );
}

function formatQuoteItem(q: IFetchQuoteResult) {
  return {
    provider: q.info.provider,
    providerName: q.info.providerName || q.info.provider,
    toAmount: q.toAmount ?? null,
    fromAmount: q.fromAmount ?? null,
    minToAmount: q.minToAmount ?? null,
    estimatedTime: q.estimatedTime ?? null,
    instantRate: q.instantRate ?? null,
    isBest: q.isBest ?? false,
    fee: q.fee ?? null,
    ...(q.errorMessage ? { errorMessage: q.errorMessage } : {}),
    ...(q.allowanceResult ? { allowanceResult: q.allowanceResult } : {}),
  };
}

function buildSSEUrl(
  env: IEndpointEnv,
  params: Record<string, string | number>,
): string {
  const host = getHost(env);
  const base = `https://swap.${host}/swap/v1/quote/events`;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    qs.set(k, String(v));
  }
  return `${base}?${qs.toString()}`;
}

/**
 * Consume SSE stream from /swap/v1/quote/events using native fetch.
 * Collects all quote results until the stream closes.
 */
export async function fetchQuotesViaSSE(
  env: IEndpointEnv,
  params: Record<string, string | number>,
): Promise<IFetchQuoteResult[]> {
  const url = buildSSEUrl(env, params);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SSE_TIMEOUT_MS);

  let response: Response;
  try {
    const baseHeaders: Record<string, string> = {
      ...buildCliAppRequestHeaders(),
      accept: 'text/event-stream',
      'accept-language': 'en-US',
      'cache-control': 'no-cache',
      pragma: 'no-cache',
    };
    const headers = await withCustomUAHeaders(url, baseHeaders);
    response = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timer);
    if ((error as Error).name === 'AbortError') {
      throw new AppError(
        ERROR_CODES.NET_RPC_TIMEOUT.code,
        'Quote SSE request timed out',
        'Check network connectivity or try again',
      );
    }
    throw new AppError(
      ERROR_CODES.NET_REQUEST_FAILED.code,
      `Quote SSE request failed: ${(error as Error).message}`,
      'Check network connectivity',
    );
  }

  if (!response.ok || !response.body) {
    clearTimeout(timer);
    throw new AppError(
      ERROR_CODES.NET_HTTP_ERROR.code,
      `Quote SSE HTTP ${response.status}: ${response.statusText}`,
      'Check API connectivity',
    );
  }

  // Validate content-type is SSE — reject proxy HTML pages or JSON fallbacks
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('text/event-stream')) {
    clearTimeout(timer);
    throw new AppError(
      ERROR_CODES.NET_HTTP_ERROR.code,
      `Quote SSE returned unexpected content-type: "${contentType}"`,
      'This may indicate a proxy or API change — check network connectivity',
    );
  }

  // Deduplicate by provider — keep only the latest quote per provider,
  // matching the app-side behavior that replaces quotes on each SSE update.
  const quotesByProvider = new Map<string, IFetchQuoteResult>();
  let currentEventId: string | undefined;
  let receivedAnyEvent = false;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let streamDone = false;

  try {
    // eslint-disable-next-line no-constant-condition
    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Parse SSE lines: "data: {...}\n\n"
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (streamDone) break;
        const trimmed = line.trim();
        if (trimmed && trimmed.startsWith('data:')) {
          const jsonStr = trimmed.slice(5).trim();
          if (jsonStr) {
            const parsed = safeParse(jsonStr);
            if (typeof parsed === 'object' && parsed !== null) {
              receivedAnyEvent = true;
              const obj = parsed as Record<string, unknown>;

              // Check for error event
              const asError = obj as unknown as ISseEventError;
              if (asError.errorMessage) {
                throw new AppError(
                  ERROR_CODES.BIZ_SWAP_FAILED.code,
                  asError.errorMessage,
                  'Try a different token pair or amount',
                );
              }

              // Check for totalQuoteCount info event — track eventId
              const asInfo = obj as unknown as ISseEventInfo;
              if (typeof asInfo.totalQuoteCount === 'number') {
                if (asInfo.totalQuoteCount === 0) {
                  // No providers support this pair — stop reading
                  streamDone = true;
                  break;
                }
                if (asInfo.eventId) {
                  currentEventId = asInfo.eventId;
                }
              }

              // Check for quote result data
              const asQuoteResult = obj as unknown as ISseEventQuoteResult;
              if (Array.isArray(asQuoteResult.data)) {
                for (const item of asQuoteResult.data) {
                  if (isValidQuoteItem(item)) {
                    // Skip quotes whose eventId doesn't match the current event
                    if (
                      currentEventId &&
                      item.eventId &&
                      item.eventId !== currentEventId
                    ) {
                      // eventId mismatch — skip stale quote
                    } else {
                      const defaultTokenInfo = {
                        networkId: '',
                        symbol: '',
                        contractAddress: '',
                        decimals: 0,
                      } as IFetchQuoteResult['fromTokenInfo'];
                      const quoteItem: IFetchQuoteResult = {
                        ...item,
                        fromTokenInfo: item.fromTokenInfo ?? defaultTokenInfo,
                        toTokenInfo: item.toTokenInfo ?? defaultTokenInfo,
                      };
                      // Replace any previous quote from the same provider
                      const providerKey = `${quoteItem.info.provider}::${quoteItem.info.providerName}`;
                      quotesByProvider.set(providerKey, quoteItem);
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  } finally {
    clearTimeout(timer);
    controller.abort();
    reader.releaseLock();
  }

  // Fail-closed: if stream ended without any parseable SSE event, treat as protocol error
  if (!receivedAnyEvent) {
    throw new AppError(
      ERROR_CODES.NET_HTTP_ERROR.code,
      'Quote SSE stream ended without any parseable events',
      'This may indicate a proxy, API change, or network issue',
    );
  }

  return [...quotesByProvider.values()];
}

async function getWalletAddress(
  impl: string,
  networkId: string,
): Promise<string> {
  const signer = await getSignerByImpl(impl);
  const addressInfo = await signer.getAddress(networkId);
  return addressInfo.address;
}

export function registerSwapQuoteCommand(parent: Command): void {
  parent
    .command('quote')
    .description('Get swap quotes with security audit')
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
    .option('--slippage <percent>', 'Slippage tolerance percentage')
    .option(
      '--sort <mode>',
      'Sort providers: recommended (default), gas_fee, swap_duration, received',
      'recommended',
    )
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
          slippage?: string;
          sort?: string;
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
          assertChainCapability(chainConfig, 'swap', 'swap-quote');
          assertChainCapability(toChainConfig, 'swap', 'swap-quote');
          const toNetworkId = toChainConfig.networkId;
          const fromNetworkId = chainConfig.networkId;
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

          // Reject zero-value amounts (covers "0", "0.0", "00", "000.000")
          if (fromTokenAmountSmallest === '0') {
            throw new AppError(
              ERROR_CODES.PARAM_INVALID_AMOUNT.code,
              'Amount must be greater than zero',
              'Provide a positive amount to swap',
            );
          }

          // Read slippage: CLI flag > config > 0.5
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

          // Try to get source wallet address for non-BTC routes.
          // Quote still works without it (just no gas estimation).
          const sourceWalletAddress = btcAddressing.from
            ? btcAddressing.from.address
            : await getWalletAddress(chainConfig.impl, chainConfig.networkId);
          const receivingAddress =
            btcAddressing.to?.address ??
            (btcAddressing.from
              ? await getWalletAddress(
                  toChainConfig.impl,
                  toChainConfig.networkId,
                )
              : sourceWalletAddress);

          // Build SSE quote params
          const _protocolConfig = getProtocolConfig(fromNetworkId, toNetworkId);
          const quoteParams: Record<string, string | number> = {
            fromTokenAddress: fromResolved.contractAddress,
            toTokenAddress: toResolved.contractAddress,
            fromTokenAmount,
            fromNetworkId,
            toNetworkId,
            slippagePercentage: slippage,
            // API uses 'Swap' for both swap and bridge; backend detects cross-chain
            // via fromNetworkId !== toNetworkId (see EProtocolOfExchange.SWAP comment)
            protocol: 'Swap',
            kind: 'sell',
          };
          if (sourceWalletAddress) {
            quoteParams.userAddress = sourceWalletAddress;
          }
          if (receivingAddress) {
            quoteParams.receivingAddress = receivingAddress;
          }

          // Resolve env from apiClient state
          const env = (
            (globalOpts.env as string) === 'prod' ? 'prod' : 'test'
          ) as IEndpointEnv;

          // Parallel: quote SSE + security audit on toToken
          // Skip security audit if toToken is native (empty contractAddress)
          // toToken lives on the destination chain — use toNetworkId for audit
          const securityPromise = toResolved.contractAddress
            ? auditToken(toNetworkId, toResolved.contractAddress)
            : null;

          const [validQuotes, securityResult] = await Promise.all([
            fetchQuotesViaSSE(env, quoteParams),
            securityPromise,
          ]);

          // If all valid quotes only have errorMessage and no toAmount, report failure
          const usableQuotes = validQuotes.filter((q) => q.toAmount);
          if (validQuotes.length > 0 && usableQuotes.length === 0) {
            const firstError = validQuotes.find((q) => q.errorMessage);
            throw new AppError(
              ERROR_CODES.BIZ_SWAP_FAILED.code,
              firstError?.errorMessage ?? 'No provider returned a usable quote',
              'Try a different token pair, amount, or slippage',
            );
          }

          // Validate response token pair matches request (networkId + contractAddress)
          for (const q of usableQuotes) {
            if (
              q.fromTokenInfo?.networkId &&
              q.fromTokenInfo.networkId !== fromResolved.networkId
            ) {
              throw new AppError(
                ERROR_CODES.NET_HTTP_ERROR.code,
                `Quote fromToken networkId mismatch: expected ${fromResolved.networkId}, got ${q.fromTokenInfo.networkId}`,
                'API may have returned data for a different token pair',
              );
            }
            if (
              q.toTokenInfo?.networkId &&
              q.toTokenInfo.networkId !== toResolved.networkId
            ) {
              throw new AppError(
                ERROR_CODES.NET_HTTP_ERROR.code,
                `Quote toToken networkId mismatch: expected ${toResolved.networkId}, got ${q.toTokenInfo.networkId}`,
                'API may have returned data for a different token pair',
              );
            }
            // Also check contractAddress (case-insensitive, empty = native)
            if (
              q.fromTokenInfo?.contractAddress !== undefined &&
              q.fromTokenInfo.contractAddress.toLowerCase() !==
                fromResolved.contractAddress.toLowerCase()
            ) {
              throw new AppError(
                ERROR_CODES.NET_HTTP_ERROR.code,
                `Quote fromToken address mismatch: expected ${fromResolved.contractAddress || '(native)'}, got ${q.fromTokenInfo.contractAddress || '(native)'}`,
                'API may have returned data for a different token',
              );
            }
            if (
              q.toTokenInfo?.contractAddress !== undefined &&
              q.toTokenInfo.contractAddress.toLowerCase() !==
                toResolved.contractAddress.toLowerCase()
            ) {
              throw new AppError(
                ERROR_CODES.NET_HTTP_ERROR.code,
                `Quote toToken address mismatch: expected ${toResolved.contractAddress || '(native)'}, got ${q.toTokenInfo.contractAddress || '(native)'}`,
                'API may have returned data for a different token',
              );
            }
          }

          // Build security output
          let security: {
            blocked: boolean;
            overallRisk: string;
            riskItems: string[];
            cautionItems: string[];
            checks: Record<string, unknown>;
          };

          if (securityResult) {
            security = {
              blocked: securityResult.isHighRisk,
              overallRisk: computeOverallRisk(securityResult),
              riskItems: securityResult.riskItems,
              cautionItems: securityResult.cautionItems,
              checks: securityResult.data,
            };
          } else {
            security = {
              blocked: false,
              overallRisk: 'unknown',
              riskItems: [],
              cautionItems: [],
              checks: {},
            };
          }

          // Sort quotes using shared logic
          const sortMode = parseSortMode(options.sort);
          const sortedQuotes = sortSwapQuotes(validQuotes, {
            sort: sortMode,
            fromTokenAmount,
          });

          // Render table to stderr (human-friendly supplement, stdout reserved for JSON)
          const fromName =
            swapNetworks.find((n) => n.networkId === fromNetworkId)?.name ??
            fromNetworkId;
          const toName =
            swapNetworks.find((n) => n.networkId === toNetworkId)?.name ??
            toNetworkId;
          const routeHeader = formatRouteHeader(fromName, toName);
          const table = renderQuoteTable(sortedQuotes, toResolved.symbol);
          if (output.getMode() === 'human') {
            output.raw(`\n${routeHeader}\n${table}\n\n`, 'stderr');
          }

          output.success(
            {
              quotes: sortedQuotes.map(formatQuoteItem),
              security,
              metadata: {
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
                networkId: chainConfig.networkId,
                walletAddress: sourceWalletAddress ?? null,
                btcAddressing,
              },
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
