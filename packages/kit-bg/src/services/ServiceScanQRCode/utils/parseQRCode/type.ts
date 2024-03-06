import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';
import type { IServerNetwork } from '@onekeyhq/shared/types';

export enum EQRCodeHandlerType {
  UNKNOWN,
  BITCOIN,
  ETHEREUM,
  LIGHTNING_NETWORK,
  URL,
  WALLET_CONNECT,
  MIGRATE,
  ANIMATION_CODE,
  DEEPLINK,
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IBaseValue {}
export interface IChainValue extends IBaseValue {
  address: string;
  amount?: string;
  network?: IServerNetwork;
  paramList?: { [key: string]: string };
}
export interface IBitcoinValue extends IChainValue {
  // Label for that address (e.g. name of receiver)
  label?: string;
  // message that describes the transaction to the user
  message?: string;
}
export interface IEthereumValue extends IChainValue {
  // Label for that address (e.g. name of receiver)
  label?: string;
  // message that describes the transaction to the user
  message?: string;

  // eip 155 compliant chain_id, used for sanity check
  id: string;
  // gas price
  gas?: number;
  // amount of gas transaction is not to exceed
  glmt?: number;
  // account nonce
  n?: number;
  // byte code data for transaction
  code?: string;
}
export interface ILightningNetworkValue extends IBaseValue {
  tag?: string;
  k1?: string;
}
export interface IWalletConnectValue extends IBaseValue {
  version: string;
  wcUri: string;
}
export interface IMigrateValue extends IBaseValue {
  address?: string;
}
export interface IAnimationValue extends IBaseValue {
  partIndex: number;
  partSize: number;
  partData: string;
  fullData?: string;
}
export interface IUrlValue extends IBaseValue {
  url: string;
  urlSchema: string;
  urlPathList: string[];
  urlParamList: { [key: string]: string };
}

export type IQRCodeHandlerResult<T extends IBaseValue> = {
  type: EQRCodeHandlerType;
  data: T;
} | null;

export type IQRCodeHandlerOptions = {
  urlResult?: IQRCodeHandlerResult<IUrlValue>;
  deeplinkResult?: IQRCodeHandlerResult<IUrlValue>;
  bitcoinUrlScheme?: string;
  backgroundApi?: IBackgroundApi;
};

export type IQRCodeHandler<T extends IBaseValue> = (
  value: string,
  options?: IQRCodeHandlerOptions,
) => Promise<IQRCodeHandlerResult<T>>;

export type IQRCodeHandlerParseResult<T extends IBaseValue> =
  IQRCodeHandlerResult<T> & { raw: string };

export type IQRCodeHandlerParseOptions = {
  autoHandleResult?: boolean;
} & IQRCodeHandlerOptions;

export type IQRCodeHandlerParse<T extends IBaseValue> = (
  value: string,
  options?: IQRCodeHandlerParseOptions,
) => Promise<IQRCodeHandlerParseResult<T>>;
