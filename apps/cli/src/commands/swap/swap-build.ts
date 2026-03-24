import { randomUUID } from 'node:crypto';

import { CHAINS, ConfigManager } from '../../config';
import { auditToken, resolveToken, savePending } from '../../core';
import { AppError, ERROR_CODES } from '../../errors';
import { apiClient } from '../../infra';
import { getSignerByImpl } from '../../signer';
import {
  amountToSmallestUnit,
  validateAmountDecimals,
} from '../../utils/tx-utils';

import type { IEndpointEnv } from '../../config';
import type { OutputFormatter } from '../../output';
import type { Command } from 'commander';

interface IBuildTxResultInfo {
  provider: string;
  providerName: string;
}

interface IBuildTxResult {
  info: IBuildTxResultInfo;
  allowanceResult?: unknown;
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
    .requiredOption(
      '--from <token>',
      'Source token (contract address or symbol)',
    )
    .requiredOption(
      '--to <token>',
      'Destination token (contract address or symbol)',
    )
    .requiredOption('--amount <amount>', 'Amount of source token to swap')
    .requiredOption(
      '--provider <provider>',
      'Swap provider ID from quote output (e.g., 1inch)',
    )
    .option('--slippage <percent>', 'Slippage tolerance percentage')
    .option('--force', 'Override high-risk token security check')
    .action(
      async (
        options: {
          chain: string;
          from: string;
          to: string;
          amount: string;
          provider: string;
          slippage?: string;
          force?: boolean;
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

          // Security audit on toToken — skip if native (empty contractAddress)
          if (toResolved.contractAddress) {
            const audit = await auditToken(
              chainConfig.networkId,
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

          const fromTokenAmount = amountToSmallestUnit(
            options.amount,
            fromResolved.decimals,
          );

          // Reject zero-value amounts
          if (fromTokenAmount === '0') {
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

          // POST /swap/v1/build-tx
          const buildTxResponse = await apiClient.post<IBuildTxResponse>(
            'swap',
            '/swap/v1/build-tx',
            {
              fromTokenAddress: fromResolved.contractAddress,
              toTokenAddress: toResolved.contractAddress,
              fromTokenAmount,
              fromNetworkId: fromResolved.networkId,
              toNetworkId: toResolved.networkId,
              provider: options.provider,
              userAddress: walletAddress,
              receivingAddress: walletAddress,
              slippagePercentage: slippage,
              protocol: 'Swap',
              kind: 'sell',
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
          const resultProvider = buildTxResponse.result.info.provider;
          if (resultProvider.toLowerCase() !== options.provider.toLowerCase()) {
            throw new AppError(
              ERROR_CODES.BIZ_SWAP_FAILED.code,
              `Build-tx provider mismatch: requested "${options.provider}", got "${resultProvider}"`,
              'API returned data for a different provider',
            );
          }

          // Validate response token info matches request (if present)
          const resultObj = buildTxResponse.result as Record<string, unknown>;
          const fromTokenInfo = resultObj.fromTokenInfo as
            | { networkId?: string; contractAddress?: string }
            | undefined;
          const toTokenInfo = resultObj.toTokenInfo as
            | { networkId?: string; contractAddress?: string }
            | undefined;
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

          // Generate orderId and save pending order
          const orderId = randomUUID();
          const now = Date.now();

          savePending(orderId, {
            orderId,
            status: 'pending',
            chain: options.chain,
            networkId: chainConfig.networkId,
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
            provider: options.provider,
          });

          // Determine if allowance approval is required
          const allowanceRequired =
            buildTxResponse.result.allowanceResult ?? null;

          output.success(
            {
              orderId,
              provider: options.provider,
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
              amountSmallestUnit: fromTokenAmount,
              slippage,
              walletAddress,
              hasTxData: buildTxResponse.tx !== undefined,
              allowanceRequired: allowanceRequired ?? null,
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
