import type {
  IEncodedTx,
  ISignedTxPro,
  IUnsignedMessage,
  IUnsignedTxPro,
} from '@onekeyhq/core/src/types';

import type {
  WALLET_TYPE_EXTERNAL,
  WALLET_TYPE_WATCHING,
} from '../dbs/local/consts';
import type { IDBWalletId } from '../dbs/local/types';

export enum EVaultKeyringTypes {
  hd = 'hd',
  hardware = 'hardware',
  imported = 'imported',
  watching = 'watching',
}

export type IVaultSettings = {
  importedAccountEnabled: boolean;
  watchingAccountEnabled: boolean;
  externalAccountEnabled: boolean;
  hardwareAccountEnabled: boolean;
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
export type IPrepareHdAccountsParams = {
  password: string;
  indexes: Array<number>;
  purpose?: number;
  names?: Array<string>;
  coinType: string;
  template: string;
  skipCheckAccountExist?: boolean;
};
export type IPrepareHardwareAccountsParams = {
  type: 'SEARCH_ACCOUNTS' | 'ADD_ACCOUNTS';
  indexes: Array<number>;
  purpose?: number;
  names?: Array<string>;
  coinType: string;
  template: string;
  skipCheckAccountExist?: boolean;
  confirmOnDevice?: boolean;
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
  token?: string; // tokenIdOnNetwork
};

// Fee ----------------------------------------------

export interface ITxUpdateFeeInfo {
  gas?: {
    gasPrice?: string; // chainValue not GWEI
    gasLimit?: string; // chainValue not GWEI
    // gas?: string; // alias for gasLimit
  };
  gasEIP1559?: {
    gasPrice?: string; // chainValue not GWEI
    maxFeePerGas?: string; // chainValue not GWEI
    maxPriorityFeePerGas?: string; // chainValue not GWEI
  };
}

// Send ------------
export interface IBuildEncodedTxParams {
  transferInfo?: ITransferInfo;
  // swapInfo
}
export interface IBuildUnsignedTxParams {
  encodedTx: IEncodedTx;
}
export interface IUpdateUnsignedTxParams {
  unsignedTx: IUnsignedTxPro;
  feeInfo?: ITxUpdateFeeInfo;
  // tokenApproveInfo
  // nonceInfo
}
export interface IBroadcastTransactionParams {
  signedTx: ISignedTxPro;
}
export interface ISignTransactionParams {
  unsignedTx: IUnsignedTxPro;
  password: string;
}
export type ISignAndSendTransactionParams = ISignTransactionParams;
export interface ISignMessageParams {
  messages: IUnsignedMessage[];
  password: string;
}
