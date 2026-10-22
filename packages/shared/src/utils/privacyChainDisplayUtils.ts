import { EOnChainHistoryTransferType } from '../../types/history';

import type { IOnChainHistoryTxTransfer } from '../../types/history';
import type {
  IDecodedTxActionAssetTransfer,
  IDecodedTxShieldedEndpoint,
} from '../../types/tx';

// Structural subset of settings.localWallet.pools (kit-bg owns the type).
export type IPrivacyChainDisplayPool = {
  id: number;
  kind: 'public' | 'private';
  label: string;
  receivesFunds?: boolean;
};

// A shielded endpoint to label in the UI; no poolId means "some shielded pool".
export type IPrivacyChainShieldedEndpointLabel = {
  poolId?: number;
};

// The account's addresses as the Receive and token details pages get them
// (servicePrivacyChain.getLocalWalletAccountAddresses).
export type IPrivacyChainAccountAddresses = {
  publicAddress?: string;
  privateAddress?: string;
};

// What a history endpoint shows:
// - own: this account's side. `address` is the own address the data names
//   (shown only when byte-identical to a displayed one); a spend has none and
//   shows the pool's displayed address. Otherwise the pool name.
// - address: an exactly known counterparty address.
// - pool: the pool name, when the address is hidden or unknown.
export type IPrivacyChainEndpointItem =
  | { kind: 'own'; poolId?: number; address?: string; isSpend?: boolean }
  | { kind: 'address'; address: string }
  | { kind: 'pool'; poolId?: number };

// Pools history may name: the chain's pools plus display-only ones that have
// no tab (and so no address).
export function getPrivacyChainDisplayPools(localWallet?: {
  pools?: IPrivacyChainDisplayPool[];
  historyOnlyPools?: { id: number; label: string }[];
}): IPrivacyChainDisplayPool[] {
  return [
    ...(localWallet?.pools ?? []),
    ...(localWallet?.historyOnlyPools ?? []).map((pool) => ({
      ...pool,
      kind: 'private' as const,
      receivesFunds: false,
    })),
  ];
}

// The single rule for showing an address of this account in history: it
// must be byte-identical to one the Receive / token details pages display.
// Anything else (a diversified address, a subaddress, a change receiver)
// could be copied and paid to without the wallet seeing it.
export function isLocalWalletDisplayedAddress({
  addresses,
  address,
}: {
  addresses?: IPrivacyChainAccountAddresses | null;
  address?: string;
}): boolean {
  return (
    !!address &&
    (address === addresses?.publicAddress ||
      address === addresses?.privateAddress)
  );
}

// Private addresses and shielded endpoints are hidden from a transaction's
// public flow: only addresses matching the chain's
// settings.localWallet.publicAddressPattern are shown; without a pattern every
// address is public.
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
    const shielded =
      direction === 'from' ? transfer?.shieldedFrom : transfer?.shieldedTo;
    // Pool projections may use a public account identifier in entries.
    // A private endpoint, marked or by address, takes precedence over them.
    if (shielded || (endpoint && !publicAddress(endpoint))) return [];
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

function isPrivatePoolId(
  pools: IPrivacyChainDisplayPool[] | undefined,
  poolId: number | undefined,
): poolId is number {
  return (
    poolId !== undefined &&
    !!pools?.some((pool) => pool.kind === 'private' && pool.id === poolId)
  );
}

// The address this account shows for a pool on the token details and Receive
// pages; undefined when it shows none (not loaded, not scanning, or a legacy
// pool that no longer receives).
export function getLocalWalletPoolDisplayAddress({
  pool,
  addresses,
}: {
  pool?: IPrivacyChainDisplayPool;
  addresses?: IPrivacyChainAccountAddresses | null;
}): string | undefined {
  if (!pool) return undefined;
  if (pool.kind === 'public') return addresses?.publicAddress;
  return pool.receivesFunds === false ? undefined : addresses?.privateAddress;
}

// Pool of a shielded I/O entry. A pool the chain does not declare is labeled
// generically.
export function getPrivacyChainShieldedEntryLabel({
  pools,
  transfer,
}: {
  pools?: IPrivacyChainDisplayPool[];
  transfer: { poolId?: number };
}): IPrivacyChainShieldedEndpointLabel {
  const { poolId } = transfer;
  return isPrivatePoolId(pools, poolId) ? { poolId } : {};
}

function matches(pattern: string | undefined, address: string): boolean {
  return !!pattern && new RegExp(pattern).test(address);
}

// What one endpoint of a history row shows (the list rows' target).
export function getPrivacyChainTargetItem({
  pools,
  publicAddressPattern,
  privateAddressPattern,
  address,
  shielded,
  side,
  ownAddresses,
}: {
  pools?: IPrivacyChainDisplayPool[];
  publicAddressPattern?: string;
  privateAddressPattern?: string;
  address?: string;
  shielded?: IDecodedTxShieldedEndpoint;
  side: 'from' | 'to';
  // Addresses the data says are this account's.
  ownAddresses?: Set<string>;
}): IPrivacyChainEndpointItem | undefined {
  if (shielded?.isOwn) {
    return {
      kind: 'own',
      poolId: shielded.poolId,
      ...(address ? { address } : {}),
      isSpend: side === 'from',
    };
  }
  if (address) {
    if (ownAddresses?.has(address)) {
      return {
        kind: 'own',
        poolId: matches(publicAddressPattern, address)
          ? pools?.find((pool) => pool.kind === 'public')?.id
          : shielded?.poolId,
        address,
      };
    }
    if (
      matches(publicAddressPattern, address) ||
      matches(privateAddressPattern, address)
    ) {
      return { kind: 'address', address };
    }
    // Matches neither pattern: named as a pool, never shown.
    return { kind: 'pool' };
  }
  return shielded ? { kind: 'pool', poolId: shielded.poolId } : undefined;
}

// One endpoint of a history row on the details page. Public addresses are
// left to the public flow; an unmarked private address counts only as a
// recorded recipient.
function getPrivacyChainEndpointItem({
  isRecordedRecipient,
  ...params
}: Parameters<typeof getPrivacyChainTargetItem>[0] & {
  isRecordedRecipient: boolean;
}): IPrivacyChainEndpointItem | undefined {
  const item = getPrivacyChainTargetItem(params);
  if (!item || item.kind === 'pool' || !item.address) return item;
  if (matches(params.publicAddressPattern, item.address)) return undefined;
  if (item.kind === 'own') return item;
  return params.shielded || isRecordedRecipient ? item : undefined;
}

// One shielded entry of a detail's wallet I/O.
export function getPrivacyChainEntryItem({
  pools,
  entry,
  isInput,
  ownAddresses,
}: {
  pools?: IPrivacyChainDisplayPool[];
  entry: Partial<
    Pick<
      IOnChainHistoryTxTransfer,
      'isOwn' | 'to' | 'address' | 'label' | 'poolId'
    >
  >;
  // Inputs are spent notes: they carry no address of their own.
  isInput: boolean;
  ownAddresses?: Set<string>;
}): IPrivacyChainEndpointItem {
  const { poolId } = getPrivacyChainShieldedEntryLabel({
    pools,
    transfer: entry,
  });
  const rawAddress = entry.to || entry.address;
  const address =
    rawAddress && rawAddress !== entry.label ? rawAddress : undefined;
  if (entry.isOwn || (address && ownAddresses?.has(address))) {
    return isInput
      ? { kind: 'own', poolId, isSpend: true }
      : { kind: 'own', poolId, ...(address ? { address } : {}) };
  }
  return address ? { kind: 'address', address } : { kind: 'pool', poolId };
}

// Addresses the data itself says are this account's: the row owner, wallet
// I/O marked as ours, and own sides of the row's transfers.
export function collectPrivacyChainOwnAddresses({
  owner,
  transfer,
  inputTransfers,
  outputTransfers,
}: {
  owner?: string;
  transfer?: IDecodedTxActionAssetTransfer;
  inputTransfers?: IOnChainHistoryTxTransfer[];
  outputTransfers?: IOnChainHistoryTxTransfer[];
}): Set<string> {
  const own = new Set<string>();
  const add = (address?: string) => {
    if (address) own.add(address);
  };
  add(owner);
  transfer?.sends.forEach((send) => {
    if (send.isOwn) add(send.from);
  });
  transfer?.receives.forEach((receive) => {
    if (receive.isOwn) add(receive.to);
  });
  [...(inputTransfers ?? []), ...(outputTransfers ?? [])].forEach((entry) => {
    if (entry.isOwn && entry.address !== entry.label) {
      add(entry.address);
      add(entry.type === EOnChainHistoryTransferType.Shielded ? entry.to : '');
    }
  });
  return own;
}

// Shielded and private endpoints on each side of a transaction: the row's own
// endpoints, then each shielded entry of the detail's wallet I/O (change
// excluded). Public addresses come from getPrivacyChainPublicDisplayFlow.
export function getPrivacyChainEndpointFlow({
  pools,
  publicAddressPattern,
  privateAddressPattern,
  transfer,
  inputTransfers,
  outputTransfers,
  isSent,
  ownAddresses,
}: {
  pools?: IPrivacyChainDisplayPool[];
  publicAddressPattern?: string;
  privateAddressPattern?: string;
  transfer?: IDecodedTxActionAssetTransfer;
  inputTransfers?: IOnChainHistoryTxTransfer[];
  outputTransfers?: IOnChainHistoryTxTransfer[];
  isSent: boolean;
  ownAddresses?: Set<string>;
}): { from: IPrivacyChainEndpointItem[]; to: IPrivacyChainEndpointItem[] } {
  // A send whose every payment output is ours recorded one of our addresses
  // as its recipient; the background has already removed it if not displayed.
  const payments = (outputTransfers ?? []).filter((entry) => !entry.isChange);
  const paysOnlyOwn =
    payments.length > 0 && payments.every((entry) => entry.isOwn);
  const side = (direction: 'from' | 'to') => {
    const endpoint = getPrivacyChainEndpointItem({
      pools,
      publicAddressPattern,
      privateAddressPattern,
      address: transfer?.[direction],
      shielded:
        direction === 'from' ? transfer?.shieldedFrom : transfer?.shieldedTo,
      side: direction,
      ownAddresses,
      isRecordedRecipient: isSent && direction === 'to' && !paysOnlyOwn,
    });
    const rawItems = [
      ...(endpoint ? [endpoint] : []),
      ...((direction === 'from' ? inputTransfers : outputTransfers) ?? [])
        .filter(
          (entry) =>
            entry.type === EOnChainHistoryTransferType.Shielded &&
            !entry.isChange,
        )
        .map((entry) =>
          getPrivacyChainEntryItem({
            pools,
            entry,
            isInput: direction === 'from',
            ownAddresses,
          }),
        ),
      // Our transparent I/O whose address the background removed.
      ...((direction === 'from' ? inputTransfers : outputTransfers) ?? [])
        .filter(
          (entry) =>
            entry.type !== EOnChainHistoryTransferType.Shielded &&
            entry.isOwn &&
            !entry.isChange &&
            !entry.address &&
            !entry[direction],
        )
        .map(
          (): IPrivacyChainEndpointItem => ({
            kind: 'own',
            poolId: pools?.find((pool) => pool.kind === 'public')?.id,
          }),
        ),
      // Our side named by pool where the background removed its address.
      ...[...(transfer?.sends ?? []), ...(transfer?.receives ?? [])].flatMap(
        (entry): IPrivacyChainEndpointItem[] => {
          const marker =
            direction === 'from' ? entry.shieldedFrom : entry.shieldedTo;
          return !entry[direction] && marker?.isOwn
            ? [{ kind: 'own', poolId: marker.poolId }]
            : [];
        },
      ),
    ];
    // An own address the row names gets its pool from the wallet I/O.
    const poolIdByOwnAddress = new Map(
      rawItems.flatMap((item) =>
        item.kind === 'own' && item.address && item.poolId !== undefined
          ? [[item.address, item.poolId] as const]
          : [],
      ),
    );
    const items = rawItems.map((item) =>
      item.kind === 'own' && item.address && item.poolId === undefined
        ? { ...item, poolId: poolIdByOwnAddress.get(item.address) }
        : item,
    );
    // "Some shielded pool" only stands in until something more specific is known.
    const isUnnamedPool = (item: IPrivacyChainEndpointItem) =>
      item.kind === 'pool' && item.poolId === undefined;
    const hasSpecific = items.some((item) => !isUnnamedPool(item));
    // A pool our side already names is not repeated as a plain pool.
    const ownPoolIds = new Set(
      items.flatMap((item) => (item.kind === 'own' ? [item.poolId] : [])),
    );
    const seen = new Set<string>();
    return items.filter((item) => {
      if (hasSpecific && isUnnamedPool(item)) return false;
      if (item.kind === 'pool' && ownPoolIds.has(item.poolId)) return false;
      const key =
        item.kind === 'address'
          ? `address:${item.address}`
          : `${item.kind}:${item.poolId ?? ''}:${
              item.kind === 'own' ? (item.address ?? '') : ''
            }`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
  return { from: side('from'), to: side('to') };
}
