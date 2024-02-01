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
  chain_id?: string;
  network?: string;
  protocol?: string;
  signTransactionVersion?: string;
  signAndSendTransactionVersion?: string;
}
export interface IBitcoinValue extends IChainValue {
  data?: {
    address?: string;
    signature?: string;
    tx?: {
      input?: {
        txid?: string;
        path?: string;
        value?: number;
        index?: number;
        type?: string;
        scriptPubKeyHex?: string;
      }[];
      outputs?: {
        address?: string;
        value?: number;
      }[];
    };
  };
}
export interface IEthereumValue extends IChainValue {
  personalSignVersion?: string;
  personalSignSignatureVersion?: string;
  signTypedDataLegacyVersion?: string;
  signTypedDataLegacySignatureVersion?: string;
  signTypeDataVersion?: string;
  signTypeDataSignatureVersion?: string;
  signTypeDataV4Version?: string;
  signTypeDataV4SignatureVersion?: string;
  data?: {
    address?: string;
    signature?: string;
    message?:
      | string
      | {
          type?: string;
          name?: string;
          value?: string;
        }[]
      | {
          types?: {
            EIP712Domain?: {
              name?: string;
              type?: string;
            }[];
            Group?: {
              name?: string;
              type?: string;
            }[];
            Person?: {
              name?: string;
              type?: string;
            }[];
            Mail?: {
              name?: string;
              type?: string;
            }[];
          };
          primaryType?: string;
          domain?: {
            name?: string;
            version?: string;
            chainId?: string;
            verifyingContract?: string;
          };
          message?:
            | {
                sender?: {
                  name?: string;
                  wallet?: string;
                };
                recipient?: {
                  name?: string;
                  wallet?: string;
                };
                contents?: string;
              }
            | {
                from?: {
                  name?: string;
                  wallet?: string[];
                };
                to?: {
                  name?: string;
                  wallet?: string[];
                }[];
                contents?: string;
              };
        };
    from?: string;
    gas?: string;
    chainId?: string;
    to?: string;
    value?: string;
    type?: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
    nonce?: string;
    rawTransaction?: string;
  };
}
export interface ILightningNetworkValue extends IBaseValue {
  tag?: string;
  k1?: string;
}
export interface IWalletConnectValue extends IBaseValue {
  topic?: string;
  version?: string;
  bridge?: string;
  key?: string;
  symKey?: string;
  relayProtocol?: string;
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
  urlSchema: string;
  urlPathList: string[];
  urlParamList: { [key: string]: string };
}

export type IQRCodeHandlerResult<T extends IBaseValue> = {
  type: EQRCodeHandlerType;
  data: T;
} | null;

export type IQRCodeHandler<T extends IBaseValue> = (
  value: string,
  options?: {
    urlResult?: IQRCodeHandlerResult<IUrlValue>;
    deeplinkResult?: IQRCodeHandlerResult<IUrlValue>;
  },
) => IQRCodeHandlerResult<T>;

export type IQRCodeHandlerParseResult<T extends IBaseValue> =
  IQRCodeHandlerResult<T> & { raw: string };

export type IQRCodeHandlerParse<T extends IBaseValue> = (
  value: string,
  options?: {
    autoHandleResult?: boolean;
  },
) => IQRCodeHandlerParseResult<T>;
