import { CHAINS, ConfigManager } from '../../config';
import { auditToken, resolveToken } from '../../core';
import { AppError, ERROR_CODES } from '../../errors';
import { apiClient } from '../../infra';
import { getSignerByImpl } from '../../signer';
import {
  amountToSmallestUnit,
  validateAmountDecimals,
} from '../../utils/tx-utils';

import type { IAuditSummary } from '../../core';
import type { OutputFormatter } from '../../output';
import type { Command } from 'commander';

/** Token stub from quote response — aligned with ISwapTokenBase */
interface IQuoteTokenInfo {
  networkId?: string;
  contractAddress?: string;
}

/** Minimal quote info returned from /swap/v1/quote — aligned with IFetchQuoteResult */
interface IQuoteResultItem {
  info: { provider: string; providerName: string };
  toAmount?: string;
  estimatedTime?: string;
  fee?: {
    percentageFee: number;
    protocolFees?: number;
    estimatedFeeFiatValue?: number;
  };
  instantRate?: string;
  fromAmount?: string;
  minToAmount?: string;
  isBest?: boolean;
  errorMessage?: string;
  fromTokenInfo?: IQuoteTokenInfo;
  toTokenInfo?: IQuoteTokenInfo;
}

function computeOverallRisk(audit: IAuditSummary): 'high' | 'caution' | 'low' {
  if (audit.isHighRisk) return 'high';
  if (audit.cautionItems.length > 0) return 'caution';
  return 'low';
}

function isValidQuoteItem(v: unknown): v is IQuoteResultItem {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  if (typeof r.info !== 'object' || r.info === null) return false;
  const info = r.info as Record<string, unknown>;
  return (
    typeof info.provider === 'string' && typeof info.providerName === 'string'
  );
}

function formatQuoteItem(q: IQuoteResultItem) {
  return {
    provider: q.info.providerName || q.info.provider,
    toAmount: q.toAmount ?? null,
    fromAmount: q.fromAmount ?? null,
    minToAmount: q.minToAmount ?? null,
    estimatedTime: q.estimatedTime ?? null,
    instantRate: q.instantRate ?? null,
    isBest: q.isBest ?? false,
    fee: q.fee ?? null,
    ...(q.errorMessage ? { errorMessage: q.errorMessage } : {}),
  };
}

async function tryGetWalletAddress(
  impl: string,
  networkId: string,
): Promise<string | undefined> {
  try {
    const signer = await getSignerByImpl(impl);
    const addressInfo = await signer.getAddress(networkId);
    return addressInfo.address;
  } catch (error) {
    // Degrade to no-address mode for expected wallet-unavailable scenarios.
    // Quote still works without userAddress (just no gas estimation).
    const appErr = AppError.from(error);
    const degradeCodes = new Set([
      ERROR_CODES.AUTH_NO_WALLET.code,
      ERROR_CODES.SEC_KEYCHAIN_LOCKED.code,
      ERROR_CODES.SEC_KEYCHAIN_ACCESS_DENIED.code,
    ]);
    if (degradeCodes.has(appErr.code)) {
      return undefined;
    }
    throw error;
  }
}

export function registerSwapQuoteCommand(parent: Command): void {
  parent
    .command('quote')
    .description('Get swap quotes with security audit')
    .requiredOption('--chain <chain>', 'Target blockchain (e.g., eth, base)')
    .requiredOption(
      '--from <token>',
      'Source token (contract address or symbol)',
    )
    .requiredOption(
      '--to <token>',
      'Destination token (contract address or symbol)',
    )
    .requiredOption('--amount <amount>', 'Amount of source token to swap')
    .option('--slippage <percent>', 'Slippage tolerance percentage')
    .action(
      async (
        options: {
          chain: string;
          from: string;
          to: string;
          amount: string;
          slippage?: string;
        },
        command,
      ) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        const globalOpts = command.optsWithGlobals() as Record<string, unknown>;
        const output = globalOpts._outputFormatter as OutputFormatter;

        try {
          const chainConfig = CHAINS[options.chain];
          if (!chainConfig) {
            throw new AppError(
              ERROR_CODES.PARAM_INVALID_CHAIN.code,
              `Unsupported chain: "${options.chain}"`,
              `Valid chains: ${Object.keys(CHAINS).join(', ')}`,
            );
          }

          // Resolve both tokens
          const [fromResolved, toResolved] = await Promise.all([
            resolveToken(options.from, options.chain),
            resolveToken(options.to, options.chain),
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

          const fromTokenAmount = amountToSmallestUnit(
            options.amount,
            fromResolved.decimals,
          );

          // Reject zero-value amounts (covers "0", "0.0", "00", "000.000")
          if (fromTokenAmount === '0') {
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

          // Try to get wallet address (optional — quote works without it)
          const walletAddress = await tryGetWalletAddress(
            chainConfig.impl,
            chainConfig.networkId,
          );

          // Build quote params
          const quoteParams: Record<string, unknown> = {
            fromTokenAddress: fromResolved.contractAddress,
            toTokenAddress: toResolved.contractAddress,
            fromTokenAmount,
            fromNetworkId: fromResolved.networkId,
            toNetworkId: toResolved.networkId,
            slippagePercentage: slippage,
            protocol: 'swap',
          };
          if (walletAddress) {
            quoteParams.userAddress = walletAddress;
          }

          // Parallel: quote API + security audit on toToken
          // Skip security audit if toToken is native (empty contractAddress)
          const securityPromise = toResolved.contractAddress
            ? auditToken(chainConfig.networkId, toResolved.contractAddress)
            : null;

          const [rawQuotes, securityResult] = await Promise.all([
            apiClient.get<unknown[]>('swap', '/swap/v1/quote', quoteParams),
            securityPromise,
          ]);

          // Validate quote response
          if (!Array.isArray(rawQuotes)) {
            throw new AppError(
              ERROR_CODES.NET_HTTP_ERROR.code,
              'Malformed quote response: expected array',
              'This may indicate an API contract change',
            );
          }

          const validQuotes = rawQuotes.filter(isValidQuoteItem);

          // If API returned items but none passed validation, the response is malformed
          if (rawQuotes.length > 0 && validQuotes.length === 0) {
            throw new AppError(
              ERROR_CODES.NET_HTTP_ERROR.code,
              'All quote items failed validation — API response may have changed',
              'Check API connectivity or report this issue',
            );
          }

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

          // Validate response token pair matches request (when fields are present)
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

          output.success(
            {
              quotes: validQuotes.map(formatQuoteItem),
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
                amount: options.amount,
                amountSmallestUnit: fromTokenAmount,
                slippage,
                networkId: chainConfig.networkId,
                walletAddress: walletAddress ?? null,
              },
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
