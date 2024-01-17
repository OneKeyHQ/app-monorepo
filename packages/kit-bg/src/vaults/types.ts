import type {
  EAddressEncodings,
  ICoreApiGetAddressItem,
  ICurveName,
  ISignedTxPro,
  IUnsignedMessage,
  IUnsignedTxPro,
} from '@onekeyhq/core/src/types';
import type { IDeviceSharedCallParams } from '@onekeyhq/shared/types/device';
import type { IFeeInfoUnit } from '@onekeyhq/shared/types/gas';
import type { IOnChainHistoryTx } from '@onekeyhq/shared/types/history';

import type {
  IAccountDeriveInfoMapBtc,
  IAccountDeriveTypesBtc,
} from './impls/btc/settings';
import type {
  IAccountDeriveInfoMapEvm,
  IAccountDeriveTypesEvm,
} from './impls/evm/settings';
import type {
  EDBAccountType,
  WALLET_TYPE_EXTERNAL,
  WALLET_TYPE_WATCHING,
} from '../dbs/local/consts';
import type { IDBWalletId } from '../dbs/local/types';
import type { MessageDescriptor } from 'react-intl';

export enum EVaultKeyringTypes {
  hd = 'hd',
  hardware = 'hardware',
  imported = 'imported',
  watching = 'watching',
}

// AccountNameInfo
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
  | IAccountDeriveInfoMapBtc;
export type IAccountDeriveTypes =
  | 'default'
  | IAccountDeriveTypesEvm
  | IAccountDeriveTypesBtc;

export type IVaultSettingsNetworkInfo = {
  addressPrefix: string;
  curve: ICurveName;
};
export type IVaultSettings = {
  importedAccountEnabled: boolean;
  watchingAccountEnabled: boolean;
  externalAccountEnabled: boolean;
  hardwareAccountEnabled: boolean;
  isUtxo: boolean;
  NFTEnabled: boolean;

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
export type IVaultOptions = IVaultFactoryOptions; // TODO remove

// PrepareAccounts ----------------------------------------------
export type IGetPrivateKeysParams = {
  password: string;
  relPaths?: string[] | undefined;
};
export type IGetPrivateKeysResult = {
  [path: string]: Buffer;
};
export type IPrepareWatchingAccountsParams = {
  target: string; // address, xpub
  name: string;
  accountIdPrefix: typeof WALLET_TYPE_WATCHING | typeof WALLET_TYPE_EXTERNAL;
  template?: string;
};
export type IPrepareImportedAccountsParams = {
  privateKey: Buffer;
  name: string;
  template?: string;
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

// Internal txInfo ----------------------------------------------
export type ITransferInfo = {
  from: string;
  to: string;
  amount: string;
  token: string; // tokenIdOnNetwork
};

// Send ------------
export interface IBuildEncodedTxParams {
  transfersInfo?: ITransferInfo[];
  // swapInfo
}
export interface IBuildDecodedTxParams {
  unsignedTx: IUnsignedTxPro[];
}
export interface IBuildUnsignedTxParams {
  transfersInfo: ITransferInfo[];
}
export interface IUpdateUnsignedTxParams {
  unsignedTx: IUnsignedTxPro;
  feeInfo?: IFeeInfoUnit;
  // tokenApproveInfo
  // nonceInfo
}
export interface IBroadcastTransactionParams {
  networkId: string;
  signedTx: ISignedTxPro;
}

export interface ISignTransactionParamsBase {
  unsignedTx: IUnsignedTxPro;
}

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
}
