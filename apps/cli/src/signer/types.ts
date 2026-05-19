import type {
  ICoreApiGetAddressItem,
  ICoreApiSignBtcExtraInfo,
  ICoreApiSignMsgPayload,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';

import type { BtcAddressType } from '../core/btc/address-types';

export interface ISignerGetAddressOptions {
  addressType?: BtcAddressType;
}

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
  relPaths?: string[];
  btcExtraInfo?: ICoreApiSignBtcExtraInfo;
  signOnly?: boolean;
  addressType?: BtcAddressType;
}

export interface ISigner {
  getAddress(
    networkId: string,
    options?: ISignerGetAddressOptions,
  ): Promise<ICoreApiGetAddressItem>;

  signTransaction(payload: ISignTransactionPayload): Promise<ISignedTxPro>;

  signMessage(payload: ICoreApiSignMsgPayload): Promise<string>;
}
