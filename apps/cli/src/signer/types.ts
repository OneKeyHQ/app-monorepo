import type {
  ICoreApiGetAddressItem,
  ICoreApiSignMsgPayload,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';

/**
 * Simplified sign-transaction input for CLI callers.
 *
 * Callers only provide what they know (network, account, unsigned tx).
 * Each ISigner implementation internally assembles whatever else it needs
 * (HD credentials for software, SDK params for hardware).
 */
export interface ICliSignTransactionParams {
  networkId: string;
  account: { address: string; path: string; publicKey?: string };
  unsignedTx: { encodedTx: Record<string, unknown> };
}

export interface ISigner {
  getAddress(networkId: string): Promise<ICoreApiGetAddressItem>;

  signTransaction(params: ICliSignTransactionParams): Promise<ISignedTxPro>;

  signMessage(payload: ICoreApiSignMsgPayload): Promise<string>;
}
