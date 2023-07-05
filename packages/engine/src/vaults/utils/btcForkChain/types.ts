import type { Token } from '../../../types/token';
import type {
  IDecodedTxDirection,
  ITransferInfo,
  IUtxoAddressInfo,
} from '../../types';
import type BigNumber from 'bignumber.js';
import type {
  NonWitnessUtxo,
  RedeemScript,
  TapInternalKey,
  WitnessUtxo,
} from 'bip174/src/lib/interfaces';

export enum AddressEncodings {
  P2PKH = 'P2PKH', // Legacy BIP-44
  P2SH_P2WPKH = 'P2SH_P2WPKH', // BIP-49 P2WPKH nested in P2SH
  P2WPKH = 'P2WPKH', // BIP-84 P2WPKH
  P2TR = 'P2TR', // BIP-86 P2TR
}

export enum TransactionStatus {
  NOT_FOUND = 0,
  PENDING = 1,
  INVALID = 2,
  CONFIRM_AND_SUCCESS = 10,
  CONFIRM_BUT_FAILED = 11,
}

export type ChainInfo = {
  code: string;
  feeCode: string;
  impl: string;
  curve: 'secp256k1' | 'ed25519';
  implOptions: { [key: string]: any };
  clients: Array<{ name: string; args: Array<any> }>;
};

export type AddressValidation = {
  isValid: boolean;
  normalizedAddress?: string;
  displayAddress?: string;
  encoding?: string;
};

export type IBtcUTXO = {
  txid: string;
  vout: number;
  value: string;
  address: string;
  path: string;
  forceSelect?: boolean;
};

export type IBtcUTXOInfo = {
  utxos: IBtcUTXO[];
  utxosFiltered: IBtcUTXO[];
  totalInscriptionValue: string;
  frozenValue?: string;
};

export type ICollectUTXOsOptions = {
  checkInscription?: boolean;
  forceSelectUtxos?: ICoinSelectUTXOLite[];
};

export type ICoinSelectUTXOLite = {
  txId: string;
  vout: number;
  address: string;
};
export type ICoinSelectUTXO = {
  txId: string; // TODO txId or txid?
  vout: number;
  value: number;
  address: string;
  path: string;
  forceSelect?: boolean;
};

export type IUTXOInput = Omit<IBtcUTXO, 'txid'> & {
  txId: string;
};
export type IUTXOOutput = { address: string; value: number };

export type IEncodedTxBtc = {
  inputs: IBtcUTXO[];
  outputs: {
    address: string;
    value: string;
    payload?: { isCharge?: boolean; bip44Path?: string };
  }[];
  feeRate: string;
  totalFee: string;
  totalFeeInNative: string;
  inputsForCoinSelect: ICoinSelectUTXO[];
  outputsForCoinSelect: {
    address: string;
    value?: number;
    isMax?: boolean;
  }[];
  transferInfo: ITransferInfo;
  transferInfos?: ITransferInfo[];
};

export type UTXO = {
  txid: string;
  vout: number;
  value: BigNumber;
};

export type TxInput = {
  address: string;
  value: BigNumber;
  tokenAddress?: string;
  utxo?: UTXO;
  publicKey?: string;
};

export type TxOutput = {
  address: string;
  value: BigNumber;
  tokenAddress?: string;
  payload?: { [key: string]: any };
};

export type UnsignedTx = {
  inputs: TxInput[];
  outputs: TxOutput[];
  type?: string;
  nonce?: number;
  feeLimit?: BigNumber;
  feePricePerUnit?: BigNumber;
  payload: { [key: string]: any };
  tokensChangedTo?: { [key: string]: string };
  encodedTx?: IEncodedTxBtc;
};

export type TransactionMixin = {
  nonWitnessUtxo?: NonWitnessUtxo;
  witnessUtxo?: WitnessUtxo;
  redeemScript?: RedeemScript;
  tapInternalKey?: TapInternalKey;
};

export interface Verifier {
  getPubkey: (compressed?: boolean) => Promise<Buffer>;
  verify: (digest: Buffer, signature: Buffer) => Promise<Buffer>;
}

export interface Signer extends Verifier {
  sign: (digest: Buffer) => Promise<[Buffer, number]>;
  getPrvkey: () => Promise<Buffer>;
}

export type SignedTx = {
  txid: string;
  rawTx: string;
};

export type IBlockBookTransaction = {
  txid: string;
  direction?: IDecodedTxDirection; // TODO move direction to UI side generate
  tokenInfo: Token;
  utxoFrom?: IUtxoAddressInfo[];
  utxoTo?: IUtxoAddressInfo[];
  from: string;
  to: string;
  amount: string;
  amountValue: string;
  confirmations: number;
  fees: string;
  blockTime?: number;
};

export type PartialTokenInfo = {
  decimals: number;
  name: string;
  symbol: string;
};

export type ArrayElement<ArrType> =
  ArrType extends readonly (infer ElementType)[] ? ElementType : never;
