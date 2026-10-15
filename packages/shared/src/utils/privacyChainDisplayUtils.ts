import type { IOnChainHistoryTxTransfer } from '../../types/history';
import type { IDecodedTxActionAssetTransfer } from '../../types/tx';

// Local-wallet chains put pool labels or private addresses into history
// address fields. Only addresses matching the chain's
// settings.localWallet.publicAddressPattern may be shown in a transaction's
// public flow; without a pattern every address is public.
export function getPrivacyChainPublicDisplayAddress({
  publicAddressPattern,
  address,
}: {
  publicAddressPattern?: string;
  address?: string;
}): string {
  if (!publicAddressPattern) {
    return address ?? '';
  }
  return address && new RegExp(publicAddressPattern).test(address)
    ? address
    : '';
}

export function getPrivacyChainPublicDisplayFlow({
  publicAddressPattern,
  transfer,
}: {
  publicAddressPattern?: string;
  transfer?: IDecodedTxActionAssetTransfer;
}): { from: string[]; to: string[] } {
  // Use transfer endpoints only. The decoded signer/owner can identify the
  // account by its public address without spending any public funds.
  const entries = [...(transfer?.sends ?? []), ...(transfer?.receives ?? [])];
  const publicAddress = (address?: string) =>
    getPrivacyChainPublicDisplayAddress({ publicAddressPattern, address });
  const addresses = (direction: 'from' | 'to'): string[] => {
    const endpoint = transfer?.[direction];
    // Pool projections may use a public account identifier in entries.
    // An explicit private endpoint must take precedence over those entries.
    if (endpoint && !publicAddress(endpoint)) return [];
    return [
      ...new Set([
        transfer?.[direction],
        ...entries.map((entry) => entry[direction]),
      ]),
    ]
      .map(publicAddress)
      .filter(Boolean);
  };
  return { from: addresses('from'), to: addresses('to') };
}

// Raised by a local-wallet vault while a broadcast's outcome is still
// unknown, so account-level operations must wait.
export const PRIVACY_CHAIN_UNRESOLVED_BROADCAST_CODE =
  'UNRESOLVED_PRIVACY_CHAIN_BROADCAST';

const PRIVACY_CHAIN_UNRESOLVED_BROADCAST_CODES = new Set<string>([
  PRIVACY_CHAIN_UNRESOLVED_BROADCAST_CODE,
  'BROADCAST_OUTCOME_UNKNOWN',
]);

export function isUnresolvedPrivacyChainBroadcastError(
  error: unknown,
): boolean {
  if (!error || typeof error !== 'object') return false;
  const errorLike = error as {
    code?: unknown;
    data?: { code?: unknown; data?: { code?: unknown } };
  };
  return [
    errorLike.code,
    errorLike.data?.code,
    errorLike.data?.data?.code,
  ].some(
    (code) =>
      typeof code === 'string' &&
      PRIVACY_CHAIN_UNRESOLVED_BROADCAST_CODES.has(code),
  );
}

// Wallet-known recipients are local facts, distinct from publicly visible endpoints.
export function getPrivacyChainWalletRecipientAddresses({
  privateAddressPattern,
  outputTransfers,
  transfer,
  isSent,
}: {
  privateAddressPattern?: string;
  outputTransfers?: IOnChainHistoryTxTransfer[];
  transfer?: IDecodedTxActionAssetTransfer;
  isSent: boolean;
}): string[] {
  if (!privateAddressPattern) return [];
  const pattern = new RegExp(privateAddressPattern);
  const candidates = (outputTransfers ?? [])
    .filter((output) => output.isOwn === false && !output.isChange)
    .map((output) => output.to || output.address || '');
  if (isSent && transfer?.to) candidates.push(transfer.to);
  return [...new Set(candidates.filter((address) => pattern.test(address)))];
}
