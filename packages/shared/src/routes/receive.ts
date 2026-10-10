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
import type { IServerNetwork } from '../../types';
import type { IAccountToken, IToken } from '../../types/token';
import type { EExchangeId } from '../consts/exchangeConsts';
import type { IWalletActionSource } from '../logger/scopes/wallet/scenes/walletActions';

export enum EModalReceiveRoutes {
  ReceiveToken = 'ReceiveToken',
  ReceiveSelector = 'ReceiveSelector',
  CreateInvoice = 'CreateInvoice',
  ReceiveInvoice = 'ReceiveInvoice',
  ReceiveSelectToken = 'ReceiveSelectToken',
  ReceiveSelectAggregateToken = 'ReceiveSelectAggregateToken',
  ReceiveSelectNetwork = 'ReceiveSelectNetwork',
  ReceiveSelectDeriveAddress = 'ReceiveSelectDeriveAddress',
  BtcAddresses = 'BtcAddresses',
  BtcFindAddress = 'BtcFindAddress',
  BtcCoins = 'BtcCoins',
  BuyModal = 'Buy',
  DeriveTypesAddress = 'DeriveTypesAddress',
  ExchangeOpenRedirect = 'ExchangeOpenRedirect',
}

export type IReceiveSwitchEntry = 'token' | 'network';

export type IReceiveNetworkSelection = {
  network: IServerNetwork;
  accountId: string;
  // The row created the address on the way (analytics).
  createdAddress?: boolean;
};

export type IReceiveSelectNetworkParams = {
  walletId: string;
  indexedAccountId?: string;
  // Any network account of the wallet (HD / hardware resolve through
  // indexedAccountId; imported / watch-only / external use it as-is).
  accountId: string;
  onSelect: (selection: IReceiveNetworkSelection) => void | Promise<void>;
};

export type IModalReceiveParamList = {
  [EModalReceiveRoutes.ReceiveSelector]:
    | {
        accountId: string;
        networkId: string;
        walletId: string;
        indexedAccountId: string | undefined;
        token: IToken;
        showSwapEntry?: boolean;
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
    // In-page network switch (card header trigger). Absent = frozen, so
    // every fixed-destination entry (Earn/Perp deposits, gas top-up,
    // copy-address verification, exchange deposit) keeps its network.
    // 'token' switches among the token's multi-chain members; 'network'
    // (entered from the network tab, title "Receive", no token) switches
    // among every wallet network.
    switchEntry?: IReceiveSwitchEntry;
    // Analytics only: which entry pushed this page, and whether the home was
    // in All Networks mode when it did.
    source?: IWalletActionSource;
    isAllNetworksMode?: boolean;
    // Multi-chain members of the token, carried along by the selecting page.
    // Without a global member list the page asks the background by
    // network + contract address, unless the entry already knows the token
    // belongs to no group (skipAggregateLookup).
    aggregateToken?: IAccountToken;
    aggregateSubTokenList?: IAccountToken[];
    allAggregateTokenList?: IAccountToken[];
    skipAggregateLookup?: boolean;
  };
  [EModalReceiveRoutes.ReceiveInvoice]: {
    networkId: string;
    accountId: string;
    paymentRequest: string;
    paymentHash: string;
  };
  [EModalReceiveRoutes.ReceiveSelectToken]: ITokenSelectorParamList;
  [EModalReceiveRoutes.ReceiveSelectAggregateToken]: IAggregateTokenSelectorParams;
  // Full network list (same rows as the Receive network tab) used as the
  // switch target of a QR page entered by network.
  [EModalReceiveRoutes.ReceiveSelectNetwork]: IReceiveSelectNetworkParams;
  [EModalReceiveRoutes.ReceiveSelectDeriveAddress]: IDeriveTypesAddressParams;
  [EModalReceiveRoutes.BtcAddresses]: {
    networkId: string;
    accountId: string;
    deriveInfo: IAccountDeriveInfo | undefined;
    walletId: string;
  };
  [EModalReceiveRoutes.BtcFindAddress]: {
    accountId: string;
    networkId: string;
    accountName: string;
    accountPath: string;
    addressTypeLabel: string;
    deriveType: string;
  };
  [EModalReceiveRoutes.BtcCoins]: {
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
