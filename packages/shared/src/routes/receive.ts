import type {
  IAccountDeriveInfo,
  IAccountDeriveTypes,
} from '@onekeyhq/kit-bg/src/vaults/types';

export enum EModalReceiveRoutes {
  ReceiveToken = 'ReceiveToken',
  CreateInvoice = 'CreateInvoice',
  ReceiveInvoice = 'ReceiveInvoice',
}

export type IModalReceiveParamList = {
  [EModalReceiveRoutes.CreateInvoice]: {
    accountId: string;
    networkId: string;
  };
  [EModalReceiveRoutes.ReceiveToken]: {
    networkId: string;
    accountId: string;
    walletId: string;
    deriveInfo: IAccountDeriveInfo;
    deriveType: IAccountDeriveTypes;
  };
  [EModalReceiveRoutes.ReceiveInvoice]: undefined;
};
