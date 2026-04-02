import type {
  IAccountSelectorSelectedAccount,
  IAccountSelectorSelectedAccountsMap,
} from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import type { IConnectionAccountInfo } from '@onekeyhq/shared/types/dappConnection';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';

export class AccountSelectorListDataScene extends BaseScene {
  @LogToLocal()
  public listDataMissingParams(params: {
    focusedWallet: string | undefined;
    deriveType: IAccountDeriveTypes | undefined;
    selectedAccount: IAccountSelectorSelectedAccount | undefined;
  }) {
    return params;
  }

  @LogToLocal()
  public buildAccountsListData(params: {
    focusedWallet: string | undefined;
    othersNetworkId: string | undefined;
    linkedNetworkId: string | undefined;
    selectedNetworkId: string | undefined;
    deriveType: IAccountDeriveTypes;
    keepAllOtherAccounts: boolean | undefined;
  }) {
    return params;
  }

  @LogToLocal()
  public focusedWalletMissing(params: { focusedWallet: string | undefined }) {
    return params;
  }

  @LogToLocal()
  public getIndexedAccountsOfWallet(params: {
    accountsLength: number;
    walletId: string;
  }) {
    return params;
  }

  @LogToLocal()
  public buildAccountsData(params: {
    accountsLength: number;
    walletId: string;
    title: string | undefined;
  }) {
    return params;
  }

  @LogToLocal()
  public dbGetWalletSafe(params: {
    isDbWalletFromParams: boolean;
    walletId: string;
    isMocked: boolean | undefined;
  }) {
    return params;
  }

  @LogToLocal()
  public dbGetAllIndexedAccounts(params: {
    indexedAccountsLength: number;
    isFromCache: boolean;
  }) {
    return params;
  }

  @LogToLocal()
  public dbFilterAllIndexedAccounts(params: {
    indexedAccountsLength: number;
    walletIdFilter: string;
    accountsFilteredLength: number;
  }) {
    return params;
  }

  @LogToLocal()
  public dbGetIndexedAccountsOfWallet(params: {
    allIndexedAccountsFromParamsLength: number | undefined;
    isDbWalletFromParams: boolean;
    walletId: string;
    resultAccountsLength: number;
  }) {
    return params;
  }

  @LogToLocal()
  public simpleDbSelectedAccountsMap(params: {
    selectedAccountsMap: IAccountSelectorSelectedAccountsMap | undefined;
  }) {
    return params;
  }

  @LogToLocal()
  public simpleDbDappConnectionSelectedAccountsMap(params: {
    connectionMap:
      | {
          [x: number]: IConnectionAccountInfo;
        }
      | undefined;
  }) {
    return params;
  }

  @LogToLocal()
  public initFromStorageDiscoverySelectedAccountsMapMerged(params: {
    selectedAccountsMap: IAccountSelectorSelectedAccountsMap | undefined;
  }) {
    return params;
  }

  @LogToLocal()
  public fixDeriveTypesForInitAccountSelectorMap(params: {
    selectedAccount: IAccountSelectorSelectedAccount;
    globalDeriveType: IAccountDeriveTypes | undefined;
    fixedDeriveType: IAccountDeriveTypes;
  }) {
    return params;
  }

  @LogToLocal()
  public fixDeriveTypesForInitAccountSelectorMapResult(params: {
    selectedAccountsMap: IAccountSelectorSelectedAccountsMap | undefined;
  }) {
    return params;
  }

  @LogToLocal()
  public initFromStorageSelectedAccountsMapResult(params: {
    selectedAccountsMap: IAccountSelectorSelectedAccountsMap | undefined;
  }) {
    return params;
  }
}
