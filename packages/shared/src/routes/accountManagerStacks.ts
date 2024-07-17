import { IDBAccount, IDBIndexedAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IAccountSelectorRouteParams } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';

export enum EAccountManagerStacksRoutes {
  AccountSelectorStack = 'AccountSelectorStack',
  ExportPrivateKeysPage = 'ExportPrivateKeysPage',
}

export type IAccountSelectorRouteParamsExtraConfig = {
  linkNetwork?: boolean;
  editable?: boolean;
};

export type IAccountManagerStacksParamList = {
  [EAccountManagerStacksRoutes.AccountSelectorStack]: IAccountSelectorRouteParams &
    IAccountSelectorRouteParamsExtraConfig;
  [EAccountManagerStacksRoutes.ExportPrivateKeysPage]: {
    indexedAccount?: IDBIndexedAccount;
    account?: IDBAccount;
  };
};
