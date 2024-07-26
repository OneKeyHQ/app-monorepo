import type {
  IAccountDeriveInfo,
  IAccountDeriveTypes,
} from '@onekeyhq/kit-bg/src/vaults/types';

import type { ITokenSelectorParamList } from './assetSelector';
import type { IToken } from '../../types/token';

export enum EModalReceiveRoutes {
  ReceiveToken = 'ReceiveToken',
  CreateInvoice = 'CreateInvoice',
  ReceiveInvoice = 'ReceiveInvoice',
  ReceiveSelectToken = 'ReceiveSelectToken',
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
    token?: IToken;
  };
  [EModalReceiveRoutes.ReceiveInvoice]: {
    networkId: string;
    accountId: string;
    paymentRequest: string;
    paymentHash: string;
  };
  [EModalReceiveRoutes.ReceiveSelectToken]: ITokenSelectorParamList;
};
