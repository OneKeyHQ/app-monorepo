import { LogToLocalDevOnly } from '../../../base/decorators';

import { AccountSelectorDevOnlyScene } from './devOnlyScene';

type ISelectedAccountLike = {
  deriveType?: string;
  focusedWallet?: unknown;
  indexedAccountId?: string;
  networkId?: string;
  othersWalletAccountId?: string;
  walletId?: string;
};
type ISelectedAccountsMapLike = Partial<Record<number, ISelectedAccountLike>>;

function buildSelectionSummary(
  selectedAccount: ISelectedAccountLike | undefined,
) {
  let accountKind = 'none';
  if (selectedAccount?.indexedAccountId) {
    accountKind = 'indexed';
  } else if (selectedAccount?.othersWalletAccountId) {
    accountKind = 'others';
  }
  return {
    accountKind,
    deriveType: selectedAccount?.deriveType,
    hasFocusedWallet: Boolean(selectedAccount?.focusedWallet),
    hasNetwork: Boolean(selectedAccount?.networkId),
    hasWallet: Boolean(selectedAccount?.walletId),
  };
}

function buildSelectionMapSummary(
  selectedAccountsMap: ISelectedAccountsMapLike | undefined,
) {
  const selections = Object.values(selectedAccountsMap || {});
  return {
    identityCount: selections.filter(
      (selection) =>
        selection?.indexedAccountId || selection?.othersWalletAccountId,
    ).length,
    selectionCount: selections.length,
  };
}

export class AccountSelectorListDataScene extends AccountSelectorDevOnlyScene {
  @LogToLocalDevOnly()
  public listDataMissingParams(params: {
    focusedWallet: string | undefined;
    deriveType: string | undefined;
    selectedAccount: ISelectedAccountLike | undefined;
  }) {
    return {
      deriveType: params.deriveType,
      hasFocusedWallet: Boolean(params.focusedWallet),
      selection: buildSelectionSummary(params.selectedAccount),
    };
  }

  @LogToLocalDevOnly()
  public buildAccountsListData(params: {
    focusedWallet: string | undefined;
    othersNetworkId: string | undefined;
    linkedNetworkId: string | undefined;
    selectedNetworkId: string | undefined;
    deriveType: string;
    keepAllOtherAccounts: boolean | undefined;
  }) {
    return {
      deriveType: params.deriveType,
      hasFocusedWallet: Boolean(params.focusedWallet),
      hasLinkedNetwork: Boolean(params.linkedNetworkId),
      hasOthersNetwork: Boolean(params.othersNetworkId),
      hasSelectedNetwork: Boolean(params.selectedNetworkId),
      keepAllOtherAccounts: params.keepAllOtherAccounts,
    };
  }

  @LogToLocalDevOnly()
  public focusedWalletMissing(params: { focusedWallet: string | undefined }) {
    return { hasFocusedWallet: Boolean(params.focusedWallet) };
  }

  @LogToLocalDevOnly()
  public getIndexedAccountsOfWallet(params: {
    accountsLength: number;
    walletId: string;
  }) {
    return {
      accountsLength: params.accountsLength,
      hasWallet: Boolean(params.walletId),
    };
  }

  @LogToLocalDevOnly()
  public buildAccountsData(params: {
    accountsLength: number;
    walletId: string;
    title: string | undefined;
  }) {
    return {
      accountsLength: params.accountsLength,
      hasTitle: Boolean(params.title),
      hasWallet: Boolean(params.walletId),
    };
  }

  @LogToLocalDevOnly()
  public dbGetWalletSafe(params: {
    isDbWalletFromParams: boolean;
    walletId: string;
    isMocked: boolean | undefined;
  }) {
    return {
      hasWallet: Boolean(params.walletId),
      isDbWalletFromParams: params.isDbWalletFromParams,
      isMocked: params.isMocked,
    };
  }

  @LogToLocalDevOnly()
  public dbGetAllIndexedAccounts(params: {
    indexedAccountsLength: number;
    isFromCache: boolean;
  }) {
    return params;
  }

  @LogToLocalDevOnly()
  public dbFilterAllIndexedAccounts(params: {
    indexedAccountsLength: number;
    walletIdFilter: string;
    accountsFilteredLength: number;
  }) {
    return {
      accountsFilteredLength: params.accountsFilteredLength,
      hasWalletFilter: Boolean(params.walletIdFilter),
      indexedAccountsLength: params.indexedAccountsLength,
    };
  }

  @LogToLocalDevOnly()
  public dbGetIndexedAccountsOfWallet(params: {
    allIndexedAccountsFromParamsLength: number | undefined;
    isDbWalletFromParams: boolean;
    walletId: string;
    resultAccountsLength: number;
  }) {
    return {
      allIndexedAccountsFromParamsLength:
        params.allIndexedAccountsFromParamsLength,
      hasWallet: Boolean(params.walletId),
      isDbWalletFromParams: params.isDbWalletFromParams,
      resultAccountsLength: params.resultAccountsLength,
    };
  }

  @LogToLocalDevOnly()
  public simpleDbSelectedAccountsMap(params: {
    selectedAccountsMap: ISelectedAccountsMapLike | undefined;
  }) {
    return buildSelectionMapSummary(params.selectedAccountsMap);
  }

  @LogToLocalDevOnly()
  public simpleDbDappConnectionSelectedAccountsMap(params: {
    connectionMap: Partial<Record<number, unknown>> | undefined;
  }) {
    return { connectionCount: Object.keys(params.connectionMap || {}).length };
  }

  @LogToLocalDevOnly()
  public initFromStorageDiscoverySelectedAccountsMapMerged(params: {
    selectedAccountsMap: ISelectedAccountsMapLike | undefined;
  }) {
    return buildSelectionMapSummary(params.selectedAccountsMap);
  }

  @LogToLocalDevOnly()
  public fixDeriveTypesForInitAccountSelectorMap(params: {
    selectedAccount: ISelectedAccountLike;
    globalDeriveType: string | undefined;
    fixedDeriveType: string;
  }) {
    return {
      fixedDeriveType: params.fixedDeriveType,
      globalDeriveType: params.globalDeriveType,
      selection: buildSelectionSummary(params.selectedAccount),
    };
  }

  @LogToLocalDevOnly()
  public fixDeriveTypesForInitAccountSelectorMapResult(params: {
    selectedAccountsMap: ISelectedAccountsMapLike | undefined;
  }) {
    return buildSelectionMapSummary(params.selectedAccountsMap);
  }

  @LogToLocalDevOnly()
  public fixOthersWalletAccountNetworkPair(params: {
    source: string | undefined;
    walletId: string | undefined;
    networkId: string | undefined;
    fixedNetworkId: string | undefined;
    accountImpl: string | undefined;
    accountCreateAtNetwork: string | undefined;
    accountNetworksCount: number | undefined;
  }) {
    return {
      accountCreateAtNetwork: params.accountCreateAtNetwork,
      accountImpl: params.accountImpl,
      accountNetworksCount: params.accountNetworksCount,
      hasFixedNetwork: Boolean(params.fixedNetworkId),
      hasNetwork: Boolean(params.networkId),
      hasWallet: Boolean(params.walletId),
      source: params.source,
    };
  }

  @LogToLocalDevOnly()
  public initFromStorageSelectedAccountsMapResult(params: {
    selectedAccountsMap: ISelectedAccountsMapLike | undefined;
  }) {
    return buildSelectionMapSummary(params.selectedAccountsMap);
  }
}
