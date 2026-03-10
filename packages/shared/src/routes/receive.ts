import type {
  IAccountDeriveInfo,
  IAccountDeriveTypes,
} from '@onekeyhq/kit-bg/src/vaults/types';

import type {
  IAggregateTokenSelectorParams,
  ITokenSelectorParamList,
} from './assetSelector';
import type { IModalFiatCryptoParamList } from './fiatCrypto';
import type { IDeriveTypesAddressParams } from './walletAddress';
import type { IToken } from '../../types/token';
import type { EExchangeId } from '../consts/exchangeConsts';

export enum EModalReceiveRoutes {
  ReceiveToken = 'ReceiveToken',
  ReceiveSelector = 'ReceiveSelector',
  CreateInvoice = 'CreateInvoice',
  ReceiveInvoice = 'ReceiveInvoice',
  ReceiveSelectToken = 'ReceiveSelectToken',
  ReceiveSelectAggregateToken = 'ReceiveSelectAggregateToken',
  ReceiveSelectDeriveAddress = 'ReceiveSelectDeriveAddress',
  BtcAddresses = 'BtcAddresses',
  BuyModal = 'Buy',
  DeriveTypesAddress = 'DeriveTypesAddress',
  ExchangeOpenRedirect = 'ExchangeOpenRedirect',
}

export type IModalReceiveParamList = {
  [EModalReceiveRoutes.ReceiveSelector]:
    | {
        accountId: string;
        networkId: string;
        walletId: string;
        indexedAccountId: string | undefined;
        token: IToken;
        onClose?: () => void;
      }
    | undefined;
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
    btcUsedAddress?: string;
    btcUsedAddressPath?: string;
    exchangeSource?: EExchangeId;
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
  [EModalReceiveRoutes.BtcAddresses]: {
    networkId: string;
    accountId: string;
    deriveInfo: IAccountDeriveInfo | undefined;
    walletId: string;
  };
  [EModalReceiveRoutes.BuyModal]: IModalFiatCryptoParamList;
  [EModalReceiveRoutes.DeriveTypesAddress]: IDeriveTypesAddressParams;
  [EModalReceiveRoutes.ExchangeOpenRedirect]: {
    exchangeSource: EExchangeId;
    address: string;
  };
};
