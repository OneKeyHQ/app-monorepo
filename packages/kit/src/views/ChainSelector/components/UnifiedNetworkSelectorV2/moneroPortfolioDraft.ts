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

function ownerKey(owner: IPortfolioDraftOwner) {
  const accountKey = owner.indexedAccountId ?? owner.accountId;
  return owner.walletId && accountKey
    ? `${owner.walletId}:${accountKey}`
    : undefined;
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
}

export function clearMoneroPortfolioDraft(owner: IPortfolioDraftOwner) {
  if (pendingDraft?.ownerKey === ownerKey(owner)) pendingDraft = undefined;
}
