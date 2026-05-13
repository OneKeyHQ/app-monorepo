import { assertAddressForChain } from '../core/address-utils';
import {
  fetchBtcDerivedBalances,
  fetchBtcExternalAddressBalance,
} from '../core/btc/account';
import { isBtcImpl } from '../core/btc/address-types';
import { assertChainCapability, resolveChain } from '../core/chain-resolver';
import { resolveToken } from '../core/token-resolver';
import { AppError, ERROR_CODES } from '../errors';
import { apiClient } from '../infra';
import { getSignerByImpl } from '../signer';

import type { IEndpointEnv } from '../config';
import type { BtcAddressType } from '../core/btc/address-types';
import type { OutputFormatter } from '../output';
import type { Command } from 'commander';

// --- API response types ---

interface IAccountResponse {
  address: string;
  balance?: string;
  balanceParsed?: string;
  nonce?: number;
}

// /wallet/v1/account/token/list response
interface ITokenListToken {
  $key: string;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  isNative?: boolean;
}

interface ITokenFiat {
  balance: string;
  balanceParsed: string;
  fiatValue?: string;
  price?: number;
}

interface ITokenListGroup {
  data: ITokenListToken[];
  map: Record<string, ITokenFiat>;
  fiatValue?: string;
}

interface ITokenListResponse {
  tokens: ITokenListGroup;
  smallBalanceTokens: ITokenListGroup;
  riskTokens: ITokenListGroup;
}

// /wallet/v1/account/token/search response item
interface ITokenSearchResult {
  balance?: string;
  balanceParsed?: string;
  fiatValue?: string;
  price?: number;
  info: {
    address: string;
    symbol: string;
    decimals: number;
  };
}

// --- Output shapes ---

interface ITokenBalanceItem {
  symbol: string;
  balance: string;
  contractAddress: string;
  fiatValue: string | null;
  isNative: boolean;
}

/**
 * Merge token metadata + balance map from a token list group into flat items.
 */
function mergeTokenGroup(group: ITokenListGroup): ITokenBalanceItem[] {
  return group.data
    .map((token) => {
      const fiat = group.map[token.$key];
      if (!fiat) return null;
      return {
        symbol: token.symbol,
        balance: fiat.balanceParsed ?? fiat.balance,
        contractAddress: token.address,
        fiatValue: fiat.fiatValue ?? null,
        isNative: token.isNative ?? false,
      };
    })
    .filter((item): item is ITokenBalanceItem => item !== null);
}

/**
 * Fetch all token balances for an account on a chain.
 * Uses POST /wallet/v1/account/token/list?flag=home-token-list
 */
async function fetchTokenList(
  networkId: string,
  accountAddress: string,
): Promise<ITokenBalanceItem[]> {
  const resp = await apiClient.post<ITokenListResponse>(
    'wallet',
    '/wallet/v1/account/token/list?flag=home-token-list',
    {
      networkId,
      accountAddress,
      contractList: [],
      hiddenTokens: [],
      unblockedTokens: [],
      blockedTokens: [],
    },
  );

  const items: ITokenBalanceItem[] = [
    ...mergeTokenGroup(resp.tokens),
    ...mergeTokenGroup(resp.smallBalanceTokens),
    ...mergeTokenGroup(resp.riskTokens),
  ];

  // Native token first, then by fiat value descending
  items.sort((a, b) => {
    if (a.isNative && !b.isNative) return -1;
    if (!a.isNative && b.isNative) return 1;
    const aVal = parseFloat(a.fiatValue ?? '0') || 0;
    const bVal = parseFloat(b.fiatValue ?? '0') || 0;
    return bVal - aVal;
  });

  return items;
}

/**
 * Fetch balance for a specific ERC-20 token.
 * Uses POST /wallet/v1/account/token/search
 */
async function fetchTokenBalance(
  networkId: string,
  accountAddress: string,
  contractAddress: string,
): Promise<{ balance: string | null; balanceRaw: string | null }> {
  const results = await apiClient.post<ITokenSearchResult[]>(
    'wallet',
    '/wallet/v1/account/token/search',
    {
      networkId,
      contractList: [contractAddress],
      accountAddress,
    },
  );

  // Verify the returned token matches the requested contract address
  const item =
    results?.find(
      (r) => r.info?.address?.toLowerCase() === contractAddress.toLowerCase(),
    ) ?? results?.[0];
  return {
    balance: item?.balanceParsed ?? null,
    balanceRaw: item?.balance ?? null,
  };
}

export function registerBalanceCommand(program: Command): void {
  program
    .command('balance')
    .description('Query wallet token balance on specified chain')
    .requiredOption('--chain <chain>', 'Target blockchain (e.g., eth, bsc)')
    .option(
      '--token <token>',
      'Token symbol or contract address (omit for all assets)',
    )
    .option('--address <address>', 'Override wallet address to query')
    .option('--address-type <type>', 'BTC address type for derived reads')
    .action(
      async (
        options: {
          chain: string;
          token?: string;
          address?: string;
          addressType?: BtcAddressType;
        },
        command,
      ) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        const globalOpts = command.optsWithGlobals() as Record<string, unknown>;
        const output = globalOpts._outputFormatter as OutputFormatter;

        try {
          const chainName = options.chain;
          const chainConfig = resolveChain(chainName);
          assertChainCapability(chainConfig, 'accountRead', 'balance');

          // Resolve env
          const env = (
            (globalOpts.env as string) === 'prod' ? 'prod' : 'test'
          ) as IEndpointEnv;
          apiClient.setEnv(env);

          if (isBtcImpl(chainConfig.impl)) {
            if (options.address && options.addressType) {
              throw new AppError(
                ERROR_CODES.PARAM_INVALID_ADDRESS.code,
                '--address cannot be used with --address-type.',
                'Omit --address-type for external address reads, or omit --address to read derived wallet addresses.',
              );
            }

            const nativeSymbols = new Set([
              chainConfig.nativeSymbol.toUpperCase(),
              chainConfig.impl === 'tbtc'
                ? 'BTC'
                : chainConfig.nativeSymbol.toUpperCase(),
            ]);

            if (
              options.token &&
              !nativeSymbols.has(options.token.toUpperCase())
            ) {
              throw new AppError(
                ERROR_CODES.PARAM_INVALID_TOKEN.code,
                'Only native BTC/TBTC balance is supported for Bitcoin chains.',
                `Use --token ${chainConfig.nativeSymbol} or omit --token.`,
              );
            }

            if (!options.address) {
              const result = await fetchBtcDerivedBalances(
                chainConfig,
                options.addressType,
              );

              output.success(result, {
                chain: chainName,
              });
              return;
            }

            const account = await fetchBtcExternalAddressBalance(
              chainConfig,
              options.address,
            );

            if (options.token) {
              output.success(
                {
                  address: account.address,
                  chain: chainName,
                  token: chainConfig.nativeSymbol,
                  contractAddress: '',
                  balance: account.balance,
                },
                { chain: chainName },
              );
              return;
            }

            output.success(
              {
                address: account.address,
                chain: chainName,
                tokens: [
                  {
                    symbol: chainConfig.nativeSymbol,
                    balance: account.balance,
                    contractAddress: '',
                    fiatValue: null,
                    isNative: true,
                  },
                ],
              },
              { chain: chainName },
            );
            return;
          }

          // Resolve wallet address
          let address = options.address;
          if (!address) {
            const signer = await getSignerByImpl(chainConfig.impl);
            const addrInfo = await signer.getAddress(chainConfig.networkId);
            address = addrInfo.address;
          } else {
            address = assertAddressForChain(chainConfig, address);
          }

          if (!options.token) {
            // --- Scenario 1: List all assets ---
            const items = await fetchTokenList(chainConfig.networkId, address);

            if (items.length === 0) {
              output.success(
                { address, chain: chainName, tokens: [] },
                { chain: chainName },
              );
              return;
            }

            output.success(
              { address, chain: chainName, tokens: items },
              { chain: chainName },
            );
            return;
          }

          // --- Scenario 2: Specific token query ---
          const resolved = await resolveToken(options.token, chainName);

          if (resolved.isNative || !resolved.contractAddress) {
            // Native token — use existing get-account endpoint
            const account = await apiClient.get<IAccountResponse>(
              'wallet',
              '/wallet/v1/account/get-account',
              {
                networkId: chainConfig.networkId,
                accountAddress: address,
                withNetWorth: true,
              },
            );

            const balanceDisplay = account.balanceParsed ?? account.balance;
            if (balanceDisplay === null || balanceDisplay === undefined) {
              throw new AppError(
                ERROR_CODES.BIZ_UNKNOWN.code,
                'API response is missing balance data',
                'This may indicate an API contract change — please report this issue',
              );
            }

            output.success(
              {
                address,
                chain: chainName,
                token: resolved.symbol,
                contractAddress: '',
                balance: balanceDisplay,
              },
              { chain: chainName },
            );
            return;
          }

          // ERC-20 token — use token/search
          const { balance, balanceRaw } = await fetchTokenBalance(
            chainConfig.networkId,
            address,
            resolved.contractAddress,
          );

          output.success(
            {
              address,
              chain: chainName,
              token: resolved.symbol,
              contractAddress: resolved.contractAddress,
              balance: balance ?? '0',
              balanceRaw: balanceRaw ?? '0',
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
