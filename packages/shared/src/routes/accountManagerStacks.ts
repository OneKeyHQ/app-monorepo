import type { IExportKeyType } from '@onekeyhq/core/src/types';
import type { IAccountSelectorRouteParams } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type {
  IDBAccount,
  IDBDevice,
  IDBIndexedAccount,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';

export enum EAccountManagerStacksRoutes {
  AccountSelectorStack = 'AccountSelectorStack',
  ExportPrivateKeysPage = 'ExportPrivateKeysPage',
  BatchCreateAccountForm = 'BatchCreateAccountForm',
  BatchCreateAccountPreview = 'BatchCreateAccountPreview',
  HardwareHomeScreenModal = 'HardwareHomeScreenModal',
  PageResolveSameWallets = 'PageResolveSameWallets',
}

export type IAccountSelectorRouteParamsExtraConfig = {
  linkNetwork?: boolean; // if true, the account selector will link the network of the selected account
  linkNetworkId?: string;
  linkNetworkDeriveType?: IAccountDeriveTypes;
  editable?: boolean;
  hideNonBackedUpWallet?: boolean;
  keepAllOtherAccounts?: boolean;
  allowSelectEmptyAccount?: boolean;
  hideAddress?: boolean;
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
  [EAccountManagerStacksRoutes.PageResolveSameWallets]: {
    sameWallets: {
      walletHash: string;
      wallets: IDBWallet[];
    }[];
  };
};
