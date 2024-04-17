import type {
  EAddressEncodings,
  ICoreApiGetAddressItem,
  ICoreImportedCredentialEncryptHex,
  ICurveName,
  IEncodedTx,
  ISignedTxPro,
  IUnsignedMessage,
  IUnsignedTxPro,
} from '@onekeyhq/core/src/types';
import type { ICoinSelectAlgorithm } from '@onekeyhq/core/src/utils/coinSelectUtils';
import type { IDeviceSharedCallParams } from '@onekeyhq/shared/types/device';
import type {
  IFeeInfoUnit,
  ISendSelectedFeeInfo,
} from '@onekeyhq/shared/types/fee';
import type {
  IAccountHistoryTx,
  IOnChainHistoryTx,
  IOnChainHistoryTxNFT,
  IOnChainHistoryTxToken,
} from '@onekeyhq/shared/types/history';
import type { ENFTType } from '@onekeyhq/shared/types/nft';
import type { ISwapTxInfo } from '@onekeyhq/shared/types/swap/types';
import type { IToken } from '@onekeyhq/shared/types/token';

import type {
  IAccountDeriveInfoMapBtc,
  IAccountDeriveTypesBtc,
} from './impls/btc/settings';
import type { IAccountDeriveInfoMapCosmos } from './impls/cosmos/settings';
import type {
  IAccountDeriveInfoMapEvm,
  IAccountDeriveTypesEvm,
} from './impls/evm/settings';
import type { IBackgroundApi } from '../apis/IBackgroundApi';
import type { EDBAccountType } from '../dbs/local/consts';
import type { IDBAccount, IDBWalletId } from '../dbs/local/types';
import type { SignClientTypes } from '@walletconnect/types';
import type { MessageDescriptor } from 'react-intl';

export enum EVaultKeyringTypes {
  hd = 'hd',
  hardware = 'hardware',
  imported = 'imported',
  watching = 'watching',
  external = 'external',
}

// AccountNameInfo
export type IAccountDeriveInfoItems = {
  value: string;
  label: string;
  item: IAccountDeriveInfo;
  description: string | undefined;
};
export interface IAccountDeriveInfo {
  // because the first account path of ledger live template is the same as the bip44 account path, so we should set idSuffix to uniq them
  idSuffix?: string; // hd-1--m/44'/60'/0'/0/0--LedgerLive
  namePrefix: string; // accountNamePrefix: EVM #1, Ledger Live #2
  // addressPrefix?: string; // use presetNetworks.extensions.providerOptions.addressPrefix instead.

  // category: string; // `44'/${COINTYPE_ETH}'`,

  template: string; // template with INDEX_PLACEHOLDER
  coinType: string;
  coinName?: string;
  addressEncoding?: EAddressEncodings;

  labelKey?: MessageDescriptor['id'];
  label?: string;

  descI18n?: {
    id: MessageDescriptor['id'];
    data: Record<string | number, string>;
  };
  desc?: string;
  subDesc?: string;

  // recommended?: boolean;
  // notRecommended?: boolean;
  enableConditions?: {
    // only available for certain networks
    networkId?: string[];
  }[];
}
export type IAccountDeriveInfoMapBase = {
  default: IAccountDeriveInfo; // default is required
};
export type IAccountDeriveInfoMap =
  | IAccountDeriveInfoMapEvm
  | IAccountDeriveInfoMapBtc
  | IAccountDeriveInfoMapCosmos;
export type IAccountDeriveTypes =
  | 'default'
  | IAccountDeriveTypesEvm
  | IAccountDeriveTypesBtc;

export type IVaultSettingsNetworkInfo = {
  addressPrefix: string;
  curve: ICurveName;
};
export type IVaultSettings = {
  impl: string;
  coinTypeDefault: string;

  importedAccountEnabled: boolean;
  watchingAccountEnabled: boolean;
  externalAccountEnabled: boolean;
  hardwareAccountEnabled: boolean;

  isUtxo: boolean;
  isSingleToken: boolean;
  NFTEnabled: boolean;
  nonceRequired: boolean;
  feeUTXORequired: boolean;
  editFeeEnabled: boolean;
  replaceTxEnabled: boolean;

  minTransferAmount?: string;
  utxoDustAmount?: string;
  signOnlyFullTxRequired?: boolean;

  accountType: EDBAccountType;
  accountDeriveInfo: IAccountDeriveInfoMap;
  networkInfo: {
    default: IVaultSettingsNetworkInfo;
    [networkId: string]: IVaultSettingsNetworkInfo;
  };
  validationRequired?: boolean;
};

export type IVaultFactoryOptions = {
  networkId: string;
  accountId: string;
  walletId?: IDBWalletId;
  isChainOnly?: boolean;
  isWalletOnly?: boolean;
};
export type IVaultOptions = IVaultFactoryOptions & {
  backgroundApi: IBackgroundApi;
};

// PrepareAccounts ----------------------------------------------
export type IGetPrivateKeysParams = {
  password: string;
  relPaths?: string[] | undefined;
};
export type IGetPrivateKeysResult = {
  [path: string]: Buffer;
};
export type IPrepareExternalAccountsParams = {
  name: string;
  networks?: string[];
  wcTopic?: string;
  wcPeerMeta?: SignClientTypes.Metadata;
};
export type IPrepareWatchingAccountsParams = {
  // target: string; // address, xpub TODO remove
  address: string;
  networks?: string[]; // watching account only available networkId
  createAtNetwork: string;
  pub?: string;
  xpub?: string;
  name: string;
  template?: string; // TODO use deriveInfo, for BTC taproot address importing
  deriveInfo?: IAccountDeriveInfo;
  isUrlAccount?: boolean;
};
export type IPrepareImportedAccountsParams = {
  password: string;
  importedCredential: ICoreImportedCredentialEncryptHex;
  createAtNetwork: string;
  name: string;
  template?: string; // TODO use deriveInfo
  deriveInfo?: IAccountDeriveInfo;
};
export type IPrepareHdAccountsParamsBase = {
  indexes: Array<number>;
  names?: Array<string>; // custom names
  deriveInfo: IAccountDeriveInfo;
  skipCheckAccountExist?: boolean; // BTC required
};
export type IPrepareHdAccountsParams = IPrepareHdAccountsParamsBase & {
  password: string;
};
export type IPrepareHdAccountsOptions = {
  checkIsAccountUsed?: (query: {
    xpub: string;
    xpubSegwit?: string;
    address: string;
  }) => Promise<{ isUsed: boolean }>;
  buildAddressesInfo: (payload: {
    usedIndexes: number[];
  }) => Promise<ICoreApiGetAddressItem[]>;
};
export type IPrepareHardwareAccountsParams = IPrepareHdAccountsParamsBase & {
  deviceParams: IDeviceSharedCallParams;
};
export type IPrepareAccountsParams =
  | IPrepareWatchingAccountsParams
  | IPrepareImportedAccountsParams
  | IPrepareHdAccountsParams
  | IPrepareHardwareAccountsParams
  | IPrepareExternalAccountsParams;

// PrepareAccountByAddressIndex
export type IPrepareAccountByAddressIndexParams = {
  password: string;
  template: string;
  accountIndex: number;
  addressIndex: number;
};

// GetAddress ----------------------------------------------
export type IHardwareGetAddressParams = {
  path: string;
  showOnOneKey: boolean;
  /**
   * for btc like chain, when isTemplatePath is true, param path is whole path
   * e.g., isTemplatePath = false, then the path is m/44'/0'/0'
   *       isTemplatePath = true, then the path is m/44'/0'/0'/0/0
   */
  isTemplatePath?: boolean;
};

export type IGetAddressParams = IHardwareGetAddressParams;

export type IBuildAccountAddressDetailParams = {
  networkId: string;
  networkInfo: IVaultSettingsNetworkInfo;
  account: IDBAccount;
  externalAccountAddress?: string;
};

// Internal txInfo ----------------------------------------------
export type ITransferInfo = {
  from: string;
  to: string;
  amount: string;

  tokenInfo?: IToken;

  nftInfo?: {
    nftId: string;
    nftType: ENFTType;
    nftAddress: string;
  };

  useCustomAddressesBalance?: boolean;
  opReturn?: string;
  coinSelectAlgorithm?: ICoinSelectAlgorithm;
};

export type IApproveInfo = {
  owner: string;
  spender: string;
  amount: string;
  isMax?: boolean;
  tokenInfo?: IToken;
};

export enum EWrappedType {
  DEPOSIT = 'deposit',
  WITHDRAW = 'withdraw',
}

export type IWrappedInfo = {
  from: string;
  amount: string;
  contract: string;
  type: EWrappedType;
};

export type IUtxoInfo = {
  txid: string;
  vout: number;
  value: string;
  height: number;
  confirmations: number;
  address: string;
  path: string;
};

export type INativeAmountInfo = {
  amount?: string;
  maxSendAmount?: string;
};

// Send ------------
export interface IBuildEncodedTxParams {
  transfersInfo?: ITransferInfo[];
  approveInfo?: IApproveInfo;
  wrappedInfo?: IWrappedInfo;
  specifiedFeeRate?: string;
}
export interface IBuildDecodedTxParams {
  unsignedTx: IUnsignedTxPro;
  feeInfo?: ISendSelectedFeeInfo;
}
export interface IBuildUnsignedTxParams {
  unsignedTx?: IUnsignedTxPro;
  encodedTx?: IEncodedTx;
  transfersInfo?: ITransferInfo[];
  approveInfo?: IApproveInfo;
  wrappedInfo?: IWrappedInfo;
  swapInfo?: ISwapTxInfo;
  specifiedFeeRate?: string;
}
export interface IUpdateUnsignedTxParams {
  unsignedTx: IUnsignedTxPro;
  feeInfo?: IFeeInfoUnit;
  nonceInfo?: { nonce: number };
  tokenApproveInfo?: { allowance: string };
  nativeAmountInfo?: INativeAmountInfo;
}
export interface IBroadcastTransactionParams {
  networkId: string;
  accountAddress: string;
  signedTx: ISignedTxPro;
}

export interface ISignTransactionParamsBase {
  unsignedTx: IUnsignedTxPro;
  // TODO rename externalSignOnly
  signOnly: boolean; // external account use this field to indicate sign only or sign and send
}

export type ISignAndSendTransactionParams = ISignTransactionParams;
export type ISignTransactionParams = ISignTransactionParamsBase & {
  password: string;
  deviceParams: IDeviceSharedCallParams | undefined;
};

export interface IBatchSignTransactionParamsBase {
  unsignedTxs: IUnsignedTxPro[];
  feeInfo?: ISendSelectedFeeInfo;
  nativeAmountInfo?: INativeAmountInfo;
  signOnly?: boolean;
}

export interface ISignMessageParams {
  messages: IUnsignedMessage[];
  password: string;
}

export interface IBuildHistoryTxParams {
  accountId: string;
  networkId: string;
  onChainHistoryTx: IOnChainHistoryTx;
  tokens: Record<string, IOnChainHistoryTxToken>;
  nfts: Record<string, IOnChainHistoryTxNFT>;
  localHistoryPendingTxs?: IAccountHistoryTx[];
  index?: number;
}

export type IGetPrivateKeyFromImportedParams = {
  input: string;
};
export type IGetPrivateKeyFromImportedResult = {
  privateKey: string;
};
export type IValidateGeneralInputParams = {
  input: string;
  validateAddress?: boolean;
  validateXpub?: boolean;
  validateXprvt?: boolean;
  validatePrivateKey?: boolean;
};
