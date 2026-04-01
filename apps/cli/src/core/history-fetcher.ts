import { apiClient } from '../infra';

// Types duplicated from @onekeyhq/shared/types/history.ts because that module
// has transitive imports from @onekeyhq/kit (ICurrencyItem), which would violate
// the import hierarchy (CLI cannot import from kit).

interface IHistoryTxTransfer {
  type: number;
  from: string;
  to: string;
  token: string;
  key: string;
  amount: string;
  label: string;
  isNative?: boolean;
}

interface IHistoryTx {
  key: string;
  networkId: string;
  tx: string;
  riskLevel: number;
  type: 'Send' | 'Receive' | 'Approve';
  status: '0' | '1' | '2';
  from: string;
  to: string;
  timestamp: number;
  nonce: number;
  gasFee: string;
  gasFeeFiatValue: string;
  functionCode: string;
  params: string[];
  value: string;
  label: string;
  sends: IHistoryTxTransfer[];
  receives: IHistoryTxTransfer[];
  block?: number;
  confirmations?: number;
  tokenApprove?: {
    amount: string;
    spender: string;
    token: string;
    key: string;
    isInfiniteAmount: boolean;
  };
  contractCall?: {
    functionName?: string;
  };
}

interface ITokenInfo {
  name: string;
  symbol: string;
  decimals: number;
  address: string;
  isNative?: boolean;
  logoURI?: string;
}

interface ITokenMapEntry {
  info: ITokenInfo;
  price: string;
}

type ITokenMap = Record<string, ITokenMapEntry>;

export interface IHistoryApiResponse {
  data: IHistoryTx[];
  tokens: ITokenMap;
  nfts: Record<string, unknown>;
  hasMore?: boolean;
}

// --- Output types ---

interface ITransferItemBase {
  token: string;
  amount: string;
  fiatValue: string;
}

interface ITransferItemDetail extends ITransferItemBase {
  contractAddress: string;
  isNative: boolean;
}

interface IHistoryItemBase {
  txHash: string;
  type: string;
  status: string;
  from: string;
  to: string;
  sends: ITransferItemBase[] | ITransferItemDetail[];
  receives: ITransferItemBase[] | ITransferItemDetail[];
  gasFee: string;
  gasFeeFiatValue: string;
  timestamp: string;
}

export interface IHistoryItemDetail extends IHistoryItemBase {
  block: number | null;
  nonce: number;
  confirmations: number | null;
  networkName: string | undefined;
  label: string;
  contractAddress: string | null;
}

export type IHistoryItem = IHistoryItemBase | IHistoryItemDetail;

// --- Pure functions ---

const STATUS_MAP: Record<string, string> = {
  '0': 'failed',
  '1': 'success',
  '2': 'pending',
};

export function mapStatus(raw: string): string {
  return STATUS_MAP[raw] ?? 'unknown';
}

export function formatAmount(raw: string, decimals: number): string {
  if (!raw || raw === '0') return '0';

  // If value already contains a decimal point, it's pre-formatted — return as-is
  // (some API responses return human-readable amounts, not raw integers)
  if (raw.includes('.')) {
    // Strip trailing zeros then trailing dot for clean output
    return raw.replace(/0+$/, '').replace(/\.$/, '') || '0';
  }

  const isNeg = raw.startsWith('-');
  const abs = isNeg ? raw.slice(1) : raw;

  if (decimals === 0) return isNeg ? `-${abs}` : abs;

  const padded = abs.padStart(decimals + 1, '0');
  const intPart = padded.slice(0, padded.length - decimals);
  const fracPart = padded.slice(padded.length - decimals).replace(/0+$/, '');

  const formatted = fracPart ? `${intPart}.${fracPart}` : intPart;
  return isNeg ? `-${formatted}` : formatted;
}

function resolveTokenInfo(
  tokenAddress: string,
  tokensMap: ITokenMap,
): { symbol: string; decimals: number; price: number; isNative: boolean } {
  const entry =
    tokensMap[tokenAddress] ??
    tokensMap[tokenAddress.toLowerCase()] ??
    (tokenAddress === '' ? tokensMap.native : undefined);

  if (entry) {
    return {
      symbol: entry.info.symbol,
      decimals: entry.info.decimals,
      price: parseFloat(entry.price) || 0,
      isNative: entry.info.isNative ?? false,
    };
  }

  return { symbol: tokenAddress, decimals: 0, price: 0, isNative: false };
}

function formatTransfer(
  t: IHistoryTxTransfer,
  tokensMap: ITokenMap,
  detail: boolean,
): ITransferItemBase | ITransferItemDetail {
  const info = resolveTokenInfo(t.token, tokensMap);
  const amount =
    info.decimals > 0 ? formatAmount(t.amount, info.decimals) : t.amount;
  const fiatNum = parseFloat(amount) * info.price;
  const fiatValue = Number.isFinite(fiatNum) ? fiatNum.toFixed(2) : '0.00';

  if (detail) {
    return {
      token: info.symbol,
      amount,
      fiatValue,
      contractAddress: t.token,
      isNative: info.isNative || (t.isNative ?? false),
    };
  }

  return { token: info.symbol, amount, fiatValue };
}

export function formatHistoryItem(
  tx: IHistoryTx,
  tokensMap: ITokenMap,
  detail: boolean,
): IHistoryItem {
  // gasFee from the server API is already in native token units (e.g. "0.0021" ETH).
  // The App (VaultBase.buildOnChainHistoryTx) assigns it directly to totalFeeInNative
  // without any decimal conversion, and the UI displays it as-is. We do the same here.
  const base: IHistoryItemBase = {
    txHash: tx.tx,
    type: tx.type,
    status: mapStatus(tx.status),
    from: tx.from,
    to: tx.to,
    sends: tx.sends.map((s) => formatTransfer(s, tokensMap, detail)),
    receives: tx.receives.map((r) => formatTransfer(r, tokensMap, detail)),
    gasFee: tx.gasFee,
    gasFeeFiatValue: tx.gasFeeFiatValue,
    timestamp: new Date(tx.timestamp * 1000).toISOString(),
  };

  if (!detail) return base;

  return {
    ...base,
    block: tx.block ?? null,
    nonce: tx.nonce,
    confirmations: tx.confirmations ?? null,
    networkName: undefined,
    label: tx.label,
    contractAddress: tx.functionCode ? tx.to : null,
  };
}

export function formatHistoryList(
  resp: IHistoryApiResponse,
  detail: boolean,
): IHistoryItem[] {
  return resp.data
    .slice()
    .toSorted((a, b) => b.timestamp - a.timestamp)
    .map((tx) => formatHistoryItem(tx, resp.tokens, detail));
}

// --- API call ---

export interface IFetchHistoryParams {
  networkId: string;
  accountAddress: string;
  tokenAddress?: string;
  limit?: number;
}

export async function fetchHistory(
  params: IFetchHistoryParams,
): Promise<IHistoryApiResponse> {
  return apiClient.post<IHistoryApiResponse>(
    'wallet',
    '/wallet/v1/account/history/list',
    {
      networkId: params.networkId,
      accountAddress: params.accountAddress,
      tokenAddress: params.tokenAddress,
      isForceRefresh: true,
      limit: params.limit ?? 20,
    },
  );
}
