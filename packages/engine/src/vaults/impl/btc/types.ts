import type { InputToSign } from '@onekeyhq/shared/src/providerApis/ProviderApiBtc/ProviderApiBtc.types';

import type { BtcMessageTypes } from '../../../types/message';
import type { NFTBTCAssetModel } from '../../../types/nft';
import type { ITransferInfo } from '../../types';
import type { SignatureOptions } from 'bitcoinjs-message';

export type IBtcUTXO = {
  txid: string;
  vout: number;
  value: string;
  address: string;
  path: string;
  inscriptions?: NFTBTCAssetModel[];
};

// TODO: this encodedTx structure could be applied to all UTXO model chains.
export type IEncodedTxBtc = {
  inputs: Array<IBtcUTXO>;
  outputs: Array<{
    address: string;
    value: string;
    payload?: { isCharge?: boolean; bip44Path?: string; opReturn?: string };
    inscriptions?: NFTBTCAssetModel[];
  }>;
  totalFee: string;
  totalFeeInNative: string;
  transferInfo: ITransferInfo;
  psbtHex?: string;
  inputsToSign?: InputToSign[];
};
export type INativeTxBtc = any;
export type IDecodedTxExtraBtc = {
  blockSize: string;
  feeRate: string;
  confirmations: number;
};

export type IBlockBookTransaction = {
  txid: string;
  vin: Array<{
    isAddress?: boolean;
    addresses: Array<string>;
    value: string;
    isOwn?: boolean;
  }>;
  vout: Array<{
    isAddress?: boolean;
    addresses: Array<string>;
    value: string;
    isOwn?: boolean;
  }>;
  confirmations: number;
  fees: string;
  blockTime?: number;
};

export type IUnsignedMessageBtc = {
  type: BtcMessageTypes;
  message: string;
  sigOptions?: (SignatureOptions & { noScriptType?: boolean }) | null;
  payload?: {
    isFromDApp?: boolean;
  };
};
