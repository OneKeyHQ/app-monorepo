import { isUndefined, omitBy } from 'lodash';

type ISelectedAccountIdentityFields = {
  walletId?: unknown;
  indexedAccountId?: unknown;
  othersWalletAccountId?: unknown;
  focusedWallet?: unknown;
  networkId?: unknown;
  deriveType?: unknown;
};

type IActiveAccountIdentityFields =
  | {
      wallet?: unknown;
      account?: unknown;
      indexedAccount?: unknown;
    }
  | undefined;

export function isDefaultSelectedAccountForColdStart(
  selectedAccount: object | undefined,
) {
  return Object.keys(omitBy(selectedAccount ?? {}, isUndefined)).length === 0;
}

export function hasSelectedAccountIdentity(
  selectedAccount: ISelectedAccountIdentityFields | undefined,
) {
  return Boolean(
    selectedAccount?.walletId ||
    selectedAccount?.indexedAccountId ||
    selectedAccount?.othersWalletAccountId ||
    selectedAccount?.focusedWallet,
  );
}

export function hasActiveAccountIdentity(
  activeAccount: IActiveAccountIdentityFields,
) {
  return Boolean(
    activeAccount?.wallet ||
    activeAccount?.account ||
    activeAccount?.indexedAccount,
  );
}

export function shouldKeepCurrentActiveAccountForIncompleteSelection({
  storageInitDone,
  selectedAccount,
  activeAccount,
}: {
  storageInitDone: boolean;
  selectedAccount: ISelectedAccountIdentityFields | undefined;
  activeAccount: IActiveAccountIdentityFields;
}) {
  if (!hasActiveAccountIdentity(activeAccount)) {
    return false;
  }

  const hasSelectedIdentity = hasSelectedAccountIdentity(selectedAccount);
  const shouldKeepDefaultBeforeStorageInit =
    !storageInitDone && isDefaultSelectedAccountForColdStart(selectedAccount);
  const shouldKeepNetworkOnlySelection =
    Boolean(selectedAccount?.networkId) && !hasSelectedIdentity;

  return shouldKeepDefaultBeforeStorageInit || shouldKeepNetworkOnlySelection;
}
