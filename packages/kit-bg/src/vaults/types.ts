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
import type { IDeviceSharedCallParams } from '@onekeyhq/shared/types/device';
import type { IFeeInfoUnit } from '@onekeyhq/shared/types/fee';
import type {
  IOnChainHistoryTx,
  IOnChainHistoryTxAsset,
} from '@onekeyhq/shared/types/history';
import type { ENFTType, IAccountNFT } from '@onekeyhq/shared/types/nft';
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
import type { MessageDescriptor } from 'react-intl';

export enum EVaultKeyringTypes {
  hd = 'hd',
  hardware = 'hardware',
  imported = 'imported',
  watching = 'watching',
}

// AccountNameInfo
export type IAccountDeriveInfoItems = {
  value: string;
  label: string;
  item: IAccountDeriveInfo;
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
  // label?:
  //   | {
  //       // LocaleIds
  //       id: MessageDescriptor['id'];
  //     }
  //   | string;
  // desc?:
  //   | {
  //       // LocaleIds
  //       id: MessageDescriptor['id'];
  //       placeholder?: any;
  //     }
  //   | string;
  // subDesc?: string;
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
  NFTEnabled: boolean;
  nonceRequired: boolean;
  editFeeEnabled: boolean;

  accountType: EDBAccountType;
  accountDeriveInfo: IAccountDeriveInfoMap;
  networkInfo: {
    default: IVaultSettingsNetworkInfo;
    [networkId: string]: IVaultSettingsNetworkInfo;
  };
};

export type IVaultFactoryOptions = {
  networkId: string;
  accountId: string;
  walletId?: IDBWalletId;
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
export type IPrepareWatchingAccountsParams = {
  // target: string; // address, xpub TODO remove
  address: string;
  networks?: string[]; // watching account only available networkId
  createAtNetwork: string;
  pub?: string;
  xpub?: string;
  name: string;
  template?: string; // TODO use deriveInfo, for BTC taproot address importing
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
  addressEncoding?: EAddressEncodings;
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
  | IPrepareHardwareAccountsParams;

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
};

export type IApproveInfo = {
  owner: string;
  spender: string;
  amount: string;
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

// Send ------------
export interface IBuildTxHelperParams {
  getToken: ({
    networkId,
    tokenIdOnNetwork,
  }: {
    networkId: string;
    tokenIdOnNetwork: string;
  }) => Promise<IToken | undefined>;
  getNFT: ({
    networkId,
    nftId,
    collectionAddress,
  }: {
    networkId: string;
    collectionAddress: string;
    nftId: string;
  }) => Promise<IAccountNFT | undefined>;
}
export interface IBuildEncodedTxParams {
  transfersInfo?: ITransferInfo[];
  approveInfo?: IApproveInfo;
  wrappedInfo?: IWrappedInfo;
}
export interface IBuildDecodedTxParams {
  unsignedTx: IUnsignedTxPro;
}
export interface IBuildUnsignedTxParams {
  unsignedTx?: IUnsignedTxPro;
  encodedTx?: IEncodedTx;
  transfersInfo?: ITransferInfo[];
  approveInfo?: IApproveInfo;
  wrappedInfo?: IWrappedInfo;
}
export interface IUpdateUnsignedTxParams {
  unsignedTx: IUnsignedTxPro;
  feeInfo?: IFeeInfoUnit;
  nonceInfo?: { nonce: number };
  tokenApproveInfo?: { allowance: string };
  maxSendInfo?: { amount: string };
}
export interface IBroadcastTransactionParams {
  networkId: string;
  signedTx: ISignedTxPro;
}

export interface ISignTransactionParamsBase {
  unsignedTx: IUnsignedTxPro;
}

export type ISignAndSendTransactionParams = ISignTransactionParams;
export type ISignTransactionParams = ISignTransactionParamsBase & {
  password: string;
  deviceParams: IDeviceSharedCallParams | undefined;
};

export interface ISignMessageParams {
  messages: IUnsignedMessage[];
  password: string;
}

export interface IBuildHistoryTxParams {
  accountId: string;
  networkId: string;
  onChainHistoryTx: IOnChainHistoryTx;
  tokens: Record<string, IOnChainHistoryTxAsset>;
}

export type IGetPrivateKeyFromImportedParams = {
  input: string;
};
export type IGetPrivateKeyFromImportedResult = {
  privateKey: string;
};
