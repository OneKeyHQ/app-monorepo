import { EOnChainHistoryTransferType } from '../../types/history';

import {
  collectPrivacyChainOwnAddresses,
  isLocalWalletDisplayedAddress,
} from './privacyChainDisplayUtils';

import type { IPrivacyChainAccountAddresses } from './privacyChainDisplayUtils';
import type {
  IAccountHistoryTx,
  IOnChainHistoryTx,
  IOnChainHistoryTxTransfer,
} from '../../types/history';
import type {
  IDecodedTxActionAssetTransfer,
  IDecodedTxShieldedEndpoint,
  IDecodedTxTransferInfo,
} from '../../types/tx';

// History shows a private address of this account only as the one Receive displays, and a
// transparent one as it is. The background applies this where rows are built, so the UI renders
// what a row carries.

// The chain's reading of an address of ours in one pool: the displayed address it stands for, if
// any. It decides by that pool's receiver only, so a private output never reads as the t-address.
export type ILocalWalletDisplayedAddressResolver = (params: {
  address: string;
  poolId: number | undefined;
  addresses: IPrivacyChainAccountAddresses;
}) => string | undefined;

export type ILocalWalletHistoryAddressGate = {
  addresses?: IPrivacyChainAccountAddresses | null;
  publicPoolId?: number;
  publicAddressPattern?: string;
  // The account's own address, which a detail's I/O may name without marking it.
  ownerAddress?: string;
  // Without one, only a byte-identical displayed address is shown.
  toDisplayedAddress?: ILocalWalletDisplayedAddressResolver;
};

export function buildLocalWalletHistoryAddressGate({
  localWallet,
  addresses,
  ownerAddress,
  toDisplayedAddress,
}: {
  localWallet?: {
    pools?: { id: number; kind: 'public' | 'private' }[];
    publicAddressPattern?: string;
    addressForms?: { publicLabel?: string };
  };
  addresses?: IPrivacyChainAccountAddresses | null;
  ownerAddress?: string;
  toDisplayedAddress?: ILocalWalletDisplayedAddressResolver;
}): ILocalWalletHistoryAddressGate {
  return {
    toDisplayedAddress,
    // Without a public form (Monero) Receive never shows the public address.
    addresses: localWallet?.addressForms?.publicLabel
      ? addresses
      : { privateAddress: addresses?.privateAddress },
    publicPoolId: localWallet?.pools?.find((pool) => pool.kind === 'public')
      ?.id,
    publicAddressPattern: localWallet?.publicAddressPattern,
    ownerAddress,
  };
}

// A transparent address of ours (a change address among them) is public on chain and shown as
// it is, as BTC shows one; only a private form must be the one Receive displays.
function hiddenOwnAddresses(
  gate: ILocalWalletHistoryAddressGate,
  own: Set<string>,
): Set<string> {
  const publicForm = gate.publicAddressPattern
    ? new RegExp(gate.publicAddressPattern)
    : undefined;
  return new Set(
    [...own].filter(
      (address) =>
        !publicForm?.test(address) &&
        !isLocalWalletDisplayedAddress({ addresses: gate.addresses, address }),
    ),
  );
}

// Our side, named by its pool instead of an address that isn't displayed.
function ownMarker(
  gate: ILocalWalletHistoryAddressGate,
  address: string,
  marker?: IDecodedTxShieldedEndpoint,
): IDecodedTxShieldedEndpoint {
  const isPublic =
    !!gate.publicAddressPattern &&
    new RegExp(gate.publicAddressPattern).test(address);
  return {
    poolId: isPublic ? gate.publicPoolId : marker?.poolId,
    isOwn: true,
  };
}

function gateTransferInfo<
  T extends Pick<
    IDecodedTxTransferInfo,
    'from' | 'to' | 'shieldedFrom' | 'shieldedTo'
  >,
>(gate: ILocalWalletHistoryAddressGate, hidden: Set<string>, target: T): T {
  const next = { ...target };
  if (hidden.has(target.from)) {
    next.from = '';
    next.shieldedFrom = ownMarker(gate, target.from, target.shieldedFrom);
  }
  if (hidden.has(target.to)) {
    next.to = '';
    next.shieldedTo = ownMarker(gate, target.to, target.shieldedTo);
  }
  return next;
}

function gateAssetTransfer(
  gate: ILocalWalletHistoryAddressGate,
  hidden: Set<string>,
  transfer: IDecodedTxActionAssetTransfer,
): IDecodedTxActionAssetTransfer {
  const sends = transfer.sends.map((send) =>
    gateTransferInfo(gate, hidden, send),
  );
  const receives = transfer.receives.map((receive) =>
    gateTransferInfo(gate, hidden, receive),
  );
  // A side that also lists a displayed address of ours keeps showing it.
  const displayedOnSide = (direction: 'from' | 'to') =>
    [...sends, ...receives]
      .map((entry) => entry[direction])
      .find(
        (address) =>
          !!address &&
          isLocalWalletDisplayedAddress({ addresses: gate.addresses, address }),
      );
  const next = gateTransferInfo(gate, hidden, transfer);
  (['from', 'to'] as const).forEach((direction) => {
    const displayed = hidden.has(transfer[direction])
      ? displayedOnSide(direction)
      : undefined;
    if (displayed) {
      next[direction] = displayed;
      if (direction === 'from') next.shieldedFrom = transfer.shieldedFrom;
      else next.shieldedTo = transfer.shieldedTo;
    }
  });
  return { ...next, sends, receives };
}

export function gateLocalWalletHistoryTx<T extends IAccountHistoryTx>(
  gate: ILocalWalletHistoryAddressGate,
  tx: T,
): T {
  // A malformed cached row is left for the list to isolate, not thrown here.
  if (!tx.decodedTx?.actions?.length) return tx;
  let changed = false;
  const actions = tx.decodedTx.actions.map((action) => {
    const transfer = action.assetTransfer;
    if (!transfer) return action;
    const hidden = hiddenOwnAddresses(
      gate,
      collectPrivacyChainOwnAddresses({ owner: tx.decodedTx.owner, transfer }),
    );
    const endpoints = [transfer, ...transfer.sends, ...transfer.receives];
    if (
      !endpoints.some(
        (endpoint) => hidden.has(endpoint.from) || hidden.has(endpoint.to),
      )
    ) {
      return action;
    }
    changed = true;
    return {
      ...action,
      assetTransfer: gateAssetTransfer(gate, hidden, transfer),
    };
  });
  return changed ? { ...tx, decodedTx: { ...tx.decodedTx, actions } } : tx;
}

// An own entry whose address the chain reads as a displayed one shows that one; the check below
// still drops anything else.
function showOwnAddressesAsDisplayed(
  gate: ILocalWalletHistoryAddressGate,
  detail: IOnChainHistoryTx,
): IOnChainHistoryTx {
  const { toDisplayedAddress, addresses } = gate;
  if (!toDisplayedAddress || !addresses) return detail;
  const showEntry =
    (ownSide: 'from' | 'to') =>
    (entry: IOnChainHistoryTxTransfer): IOnChainHistoryTxTransfer => {
      const address = entry.address || entry[ownSide];
      if (!entry.isOwn || !address) return entry;
      const isPrivate = entry.type === EOnChainHistoryTransferType.Shielded;
      const displayed = toDisplayedAddress({
        address,
        poolId: isPrivate ? entry.poolId : gate.publicPoolId,
        addresses,
      });
      if (
        !displayed ||
        displayed === address ||
        !isLocalWalletDisplayedAddress({ addresses, address: displayed })
      ) {
        return entry;
      }
      return { ...entry, address: displayed, [ownSide]: displayed };
    };
  return {
    ...detail,
    ...(detail.sends ? { sends: detail.sends.map(showEntry('from')) } : {}),
    ...(detail.receives
      ? { receives: detail.receives.map(showEntry('to')) }
      : {}),
  };
}

// A detail's wallet I/O: an own entry whose address isn't displayed keeps its
// amount and pool but loses the address.
export function gateLocalWalletHistoryDetail(
  gate: ILocalWalletHistoryAddressGate,
  rawDetail: IOnChainHistoryTx,
): IOnChainHistoryTx {
  const detail = showOwnAddressesAsDisplayed(gate, rawDetail);
  const own = collectPrivacyChainOwnAddresses({
    owner: gate.ownerAddress,
    inputTransfers: detail.sends,
    outputTransfers: detail.receives,
  });
  // Our side of each entry: an input's sender, an output's receiver.
  detail.sends?.forEach((entry) => {
    if (entry.isOwn && entry.from) own.add(entry.from);
  });
  detail.receives?.forEach((entry) => {
    if (entry.isOwn && entry.to) own.add(entry.to);
  });
  const hidden = hiddenOwnAddresses(gate, own);
  if (!hidden.size) return detail;
  // Only a hidden address on the entry's own side (an input's sender, an
  // output's receiver) makes it ours; the other side is just blanked.
  const gateEntry =
    (ownSide: 'from' | 'to') =>
    (entry: IOnChainHistoryTxTransfer): IOnChainHistoryTxTransfer => {
      const fields = (['address', 'from', 'to'] as const).filter((field) =>
        hidden.has(entry[field] ?? ''),
      );
      if (!fields.length) return entry;
      return {
        ...entry,
        ...Object.fromEntries(fields.map((field) => [field, ''])),
        isOwn:
          entry.isOwn ||
          fields.some((field) => field === 'address' || field === ownSide),
      };
    };
  return {
    ...detail,
    from: hidden.has(detail.from) ? '' : detail.from,
    to: hidden.has(detail.to) ? '' : detail.to,
    sends: detail.sends?.map(gateEntry('from')),
    receives: detail.receives?.map(gateEntry('to')),
  };
}
