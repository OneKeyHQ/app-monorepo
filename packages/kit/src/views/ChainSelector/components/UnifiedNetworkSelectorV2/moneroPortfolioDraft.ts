type IPortfolioDraftOwner = {
  walletId: string;
  accountId: string | undefined;
  indexedAccountId: string | undefined;
};

export type IMoneroPortfolioDraft = {
  enabledNetworks: Record<string, boolean>;
  disabledNetworks: Record<string, boolean>;
};

// This is an unsaved UI draft, never a persisted network preference.
let pendingDraft:
  | { ownerKey: string; selection: IMoneroPortfolioDraft }
  | undefined;
const draftListeners = new Set<() => void>();

export function subscribeMoneroPortfolioDraft(listener: () => void) {
  draftListeners.add(listener);
  return () => {
    draftListeners.delete(listener);
  };
}

function notifyDraftChanged() {
  draftListeners.forEach((listener) => listener());
}

function ownerKey(owner: IPortfolioDraftOwner) {
  const accountKey = owner.indexedAccountId ?? owner.accountId;
  return owner.walletId
    ? `${owner.walletId}:${accountKey || 'empty-wallet'}`
    : undefined;
}

export function captureEmptyMoneroPortfolioDraft(walletId: string) {
  const emptyKey = ownerKey({
    walletId,
    accountId: undefined,
    indexedAccountId: undefined,
  });
  return pendingDraft?.ownerKey === emptyKey ? pendingDraft : undefined;
}

export function handoffEmptyMoneroPortfolioDraft({
  source,
  walletId,
  indexedAccountId,
}: {
  source: ReturnType<typeof captureEmptyMoneroPortfolioDraft>;
  walletId: string;
  indexedAccountId: string;
}) {
  // Only the exact draft captured before this explicit first-account creation can move.
  if (
    !source ||
    pendingDraft !== source ||
    captureEmptyMoneroPortfolioDraft(walletId) !== source ||
    !indexedAccountId
  )
    return;
  const key = ownerKey({ walletId, accountId: undefined, indexedAccountId });
  if (key) {
    pendingDraft = { ...source, ownerKey: key };
    notifyDraftChanged();
  }
}

export function readMoneroPortfolioDraft(owner: IPortfolioDraftOwner) {
  if (!pendingDraft || pendingDraft.ownerKey !== ownerKey(owner)) {
    return undefined;
  }
  return {
    enabledNetworks: { ...pendingDraft.selection.enabledNetworks },
    disabledNetworks: { ...pendingDraft.selection.disabledNetworks },
  };
}

export function saveMoneroPortfolioDraft(
  owner: IPortfolioDraftOwner,
  selection: IMoneroPortfolioDraft,
) {
  const key = ownerKey(owner);
  if (!key) return;
  pendingDraft = {
    ownerKey: key,
    selection: {
      enabledNetworks: { ...selection.enabledNetworks },
      disabledNetworks: { ...selection.disabledNetworks },
    },
  };
  notifyDraftChanged();
}

export function clearMoneroPortfolioDraft(owner: IPortfolioDraftOwner) {
  if (pendingDraft?.ownerKey === ownerKey(owner)) {
    pendingDraft = undefined;
    notifyDraftChanged();
  }
}
