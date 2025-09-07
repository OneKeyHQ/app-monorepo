import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';

import type {
  IAggregateTokenSelectorParams,
  ITokenSelectorParamList,
} from './assetSelector';
import type { IDeriveTypesAddressParams } from './walletAddress';
import type { IToken } from '../../types/token';

export enum EModalReceiveRoutes {
  ReceiveToken = 'ReceiveToken',
  CreateInvoice = 'CreateInvoice',
  ReceiveInvoice = 'ReceiveInvoice',
  ReceiveSelectToken = 'ReceiveSelectToken',
  ReceiveSelectAggregateToken = 'ReceiveSelectAggregateToken',
  ReceiveSelectDeriveAddress = 'ReceiveSelectDeriveAddress',
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
    indexedAccountId?: string;
    token?: IToken;
    onDeriveTypeChange?: (deriveType: IAccountDeriveTypes) => void;
    disableSelector?: boolean;
  };
  [EModalReceiveRoutes.ReceiveInvoice]: {
    networkId: string;
    accountId: string;
    paymentRequest: string;
    paymentHash: string;
  };
  [EModalReceiveRoutes.ReceiveSelectToken]: ITokenSelectorParamList;
  [EModalReceiveRoutes.ReceiveSelectAggregateToken]: IAggregateTokenSelectorParams;
  [EModalReceiveRoutes.ReceiveSelectDeriveAddress]: IDeriveTypesAddressParams;
};
