import type {
  ICoreApiGetAddressItem,
  ICoreApiSignMsgPayload,
  ICoreApiSignTxPayload,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';

export interface ISigner {
  getAddress(networkId: string): Promise<ICoreApiGetAddressItem>;

  signTransaction(payload: ICoreApiSignTxPayload): Promise<ISignedTxPro>;

  signMessage(payload: ICoreApiSignMsgPayload): Promise<string>;
}
