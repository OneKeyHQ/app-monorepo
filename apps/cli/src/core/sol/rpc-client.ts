import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

import { AppError, ERROR_CODES } from '../../errors';
import { apiClient } from '../../infra';

import type { AccountInfo } from '@solana/web3.js';

export enum ESolRpcMethod {
  GET_LATEST_BLOCK_HASH = 'getLatestBlockhash',
  GET_ACCOUNT_INFO = 'getAccountInfo',
  GET_RECENT_PRIORITIZATION_FEES = 'getRecentPrioritizationFees',
  GET_TOKEN_ACCOUNTS_BY_OWNER = 'getTokenAccountsByOwner',
  SEND_TRANSACTION = 'sendTransaction',
  GET_SIGNATURE_STATUSES = 'getSignatureStatuses',
}

export enum ESolRpcEncoding {
  BASE64 = 'base64',
  JSON_PARSED = 'jsonParsed',
}

interface IProxyResp<T> {
  data: Array<{
    success: boolean;
    data: T;
    error?: string;
  }>;
}

export interface ISolBlockhashInfo {
  recentBlockhash: string;
  lastValidBlockHeight: number;
}

export interface ISolPrioritizationFee {
  slot: number;
  prioritizationFee: number;
}

async function rpc<T>(
  networkId: string,
  method: ESolRpcMethod,
  params: unknown[],
): Promise<T> {
  const resp = await apiClient.post<IProxyResp<T>>(
    'wallet',
    '/wallet/v1/proxy/wallet',
    {
      networkId,
      body: [
        {
          route: 'rpc',
          params: { method, params },
        },
      ],
    },
  );
  const item = resp.data?.[0];
  if (!item) {
    throw new AppError(
      ERROR_CODES.NET_REQUEST_FAILED.code,
      `SOL RPC ${method} returned empty proxy response.`,
      'Check API connectivity and retry.',
    );
  }
  if (!item.success) {
    throw new AppError(
      ERROR_CODES.BIZ_UNKNOWN.code,
      `SOL RPC ${method} failed: ${item.error ?? 'unknown error'}`,
      'Check the network status or retry.',
    );
  }
  return item.data;
}

export async function getSolLatestBlockhash(
  networkId: string,
): Promise<ISolBlockhashInfo> {
  const response = await rpc<{
    value: { blockhash: string; lastValidBlockHeight: number };
  }>(networkId, ESolRpcMethod.GET_LATEST_BLOCK_HASH, [
    { commitment: 'confirmed' },
  ]);
  return {
    recentBlockhash: response.value.blockhash,
    lastValidBlockHeight: response.value.lastValidBlockHeight,
  };
}

// Returns null when the account does not exist — callers rely on this to
// detect missing ATAs.
export async function getSolAccountInfo(
  networkId: string,
  address: string,
  encoding: ESolRpcEncoding = ESolRpcEncoding.JSON_PARSED,
): Promise<AccountInfo<[string, string]> | null> {
  const response = await rpc<{
    value: AccountInfo<[string, string]> | null;
  }>(networkId, ESolRpcMethod.GET_ACCOUNT_INFO, [address, { encoding }]);
  return response.value;
}

export async function getSolRecentMaxPrioritizationFee(
  networkId: string,
  accountAddresses: string[],
): Promise<number> {
  const fees = await rpc<ISolPrioritizationFee[]>(
    networkId,
    ESolRpcMethod.GET_RECENT_PRIORITIZATION_FEES,
    [accountAddresses],
  );
  if (!Array.isArray(fees) || fees.length === 0) {
    return 0;
  }
  return fees.reduce(
    (acc, f) => (f.prioritizationFee > acc ? f.prioritizationFee : acc),
    0,
  );
}

export interface ISolTokenAccountByOwner {
  account: {
    data: {
      parsed: {
        info: {
          mint: string;
          owner: string;
        };
      };
      program: string; // 'spl-token' | 'spl-token-2022'
    };
    owner: string;
  };
  pubkey: string;
}

// If programId is omitted, defaults to the original SPL Token program.
export async function getSolTokenAccountsByOwner(
  networkId: string,
  owner: string,
  programId?: string,
): Promise<ISolTokenAccountByOwner[]> {
  const filter = programId
    ? { programId }
    : { programId: TOKEN_PROGRAM_ID.toBase58() };
  const response = await rpc<{ value: ISolTokenAccountByOwner[] }>(
    networkId,
    ESolRpcMethod.GET_TOKEN_ACCOUNTS_BY_OWNER,
    [owner, filter, { encoding: ESolRpcEncoding.JSON_PARSED }],
  );
  return response.value ?? [];
}

export async function sendSolRawTransaction(
  networkId: string,
  rawTxBase64: string,
): Promise<string> {
  return rpc<string>(networkId, ESolRpcMethod.SEND_TRANSACTION, [
    rawTxBase64,
    { encoding: ESolRpcEncoding.BASE64, skipPreflight: false },
  ]);
}
