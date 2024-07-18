import type {
  IDBAccount,
  IDBIndexedAccount,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IAccountSelectorRouteParams } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';

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

export type IExportAccountSecretKeysRouteParams = {
  indexedAccount?: IDBIndexedAccount;
  account?: IDBAccount;
  accountName?: string;
  title?: string;
  exportType: 'privateKey' | 'publicKey';
};
export type IAccountManagerStacksParamList = {
  [EAccountManagerStacksRoutes.AccountSelectorStack]: IAccountSelectorRouteParams &
    IAccountSelectorRouteParamsExtraConfig;
  [EAccountManagerStacksRoutes.ExportPrivateKeysPage]: IExportAccountSecretKeysRouteParams;
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
