import type {
  ICoreApiGetAddressItem,
  ICoreApiSignMsgPayload,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';

/**
 * Minimal sign-transaction input for `ISigner`.
 *
 * Commands only carry what they directly know (network, account, unsigned
 * tx). Each `ISigner` implementation internally assembles whatever else
 * it needs before delegating to core / the hardware SDK — HD credentials
 * from the keychain for software, device params + passphrase state for
 * hardware.
 */
export interface ISignTransactionPayload {
  networkId: string;
  account: { address: string; path: string; pub?: string };
  unsignedTx: { encodedTx: Record<string, unknown> };
}

export interface ISigner {
  getAddress(networkId: string): Promise<ICoreApiGetAddressItem>;

  signTransaction(payload: ISignTransactionPayload): Promise<ISignedTxPro>;

  signMessage(payload: ICoreApiSignMsgPayload): Promise<string>;
}
