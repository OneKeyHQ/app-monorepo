import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';

export class AccountSelectorListDataScene extends BaseScene {
  @LogToLocal()
  public listDataMissingParams(params: {
    focusedWallet: string | undefined;
    deriveType: IAccountDeriveTypes | undefined;
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
}
