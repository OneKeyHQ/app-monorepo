import type { IAccountSelectorRouteParams } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';

export enum EAccountManagerStacksRoutes {
  AccountSelectorStack = 'AccountSelectorStack',
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
