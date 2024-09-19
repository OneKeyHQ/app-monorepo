import type { IExportKeyType } from '@onekeyhq/core/src/types';
import type { IAccountSelectorRouteParams } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type {
  IDBAccount,
  IDBDevice,
  IDBIndexedAccount,
} from '@onekeyhq/kit-bg/src/dbs/local/types';

export enum EAccountManagerStacksRoutes {
  AccountSelectorStack = 'AccountSelectorStack',
  ExportPrivateKeysPage = 'ExportPrivateKeysPage',
  BatchCreateAccountForm = 'BatchCreateAccountForm',
  BatchCreateAccountPreview = 'BatchCreateAccountPreview',
  HardwareHomeScreenModal = 'HardwareHomeScreenModal',
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
  exportType: IExportKeyType;
};
export type IAccountManagerStacksParamList = {
  [EAccountManagerStacksRoutes.AccountSelectorStack]: IAccountSelectorRouteParams &
    IAccountSelectorRouteParamsExtraConfig;
  [EAccountManagerStacksRoutes.ExportPrivateKeysPage]: IExportAccountSecretKeysRouteParams;
  [EAccountManagerStacksRoutes.BatchCreateAccountForm]: {
    walletId: string;
    networkId: string | undefined;
  };
  [EAccountManagerStacksRoutes.BatchCreateAccountPreview]: {
    walletId: string;
    networkId: string;
    from: string;
    count: string;
  };
  [EAccountManagerStacksRoutes.HardwareHomeScreenModal]: {
    device: IDBDevice;
  };
};
