import type { IAccountSelectorRouteParams } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type {
  IDBAccount,
  IDBIndexedAccount,
} from '@onekeyhq/kit-bg/src/dbs/local/types';

export enum EAccountManagerStacksRoutes {
  AccountSelectorStack = 'AccountSelectorStack',
  ExportPrivateKeysPage = 'ExportPrivateKeysPage',
  BatchCreateAccountForm = 'BatchCreateAccountForm',
  BatchCreateAccountPreview = 'BatchCreateAccountPreview',
  BatchCreateAccountProcessing = 'BatchCreateAccountProcessing',
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
    accountName?: string;
  };
  [EAccountManagerStacksRoutes.BatchCreateAccountForm]: {
    walletId: string;
  };
  [EAccountManagerStacksRoutes.BatchCreateAccountPreview]: {
    walletId: string;
    networkId: string;
    from: string;
    count: string;
  };
  [EAccountManagerStacksRoutes.BatchCreateAccountProcessing]: undefined;
};
