import type { IUtxoInfo } from '@onekeyhq/kit-bg/src/vaults/types';

import type { EAddressEncodings, ITxInputToSign } from '../../types';
import type BigNumber from 'bignumber.js';
import type {
  Bip32Derivation,
  NonWitnessUtxo,
  RedeemScript,
  TapBip32Derivation,
  TapInternalKey,
  WitnessUtxo,
} from 'bip174/src/lib/interfaces';
import type { Network, Signer } from 'bitcoinjs-lib';

export interface IBtcForkNetwork extends Network {
  networkChainCode?: string;
  // Extends the network interface to support:
  //   - segwit address version bytes
  segwitVersionBytes?: Partial<Record<EAddressEncodings, Network['bip32']>>;
  forkId?: number; // bch
}
export type IBtcForkSigner = Signer;

export type IBtcForkTransactionMixin = {
  nonWitnessUtxo?: NonWitnessUtxo;
  witnessUtxo?: WitnessUtxo;
  redeemScript?: RedeemScript;
  tapInternalKey?: TapInternalKey;

  bip32Derivation?: Bip32Derivation[];
  /*
  Error: Data for input key tapBip32Derivation is incorrect: Expected { masterFingerprint: Buffer; pubkey: Buffer; path: string; leafHashes: Buffer[]; } and got [{"masterFingerprint":{"type":"Buffer","data":[252,136,90,94]},"pubkey":{"type":"Buffer","data":[2,134,33,30,23,156,33,141,61,253,52,82,113,249,47,202,169,93,45,116,145,238,61,68,219,45,160,22,241,121,83,183,27]},"path":"m/86'/0'/0'/0/0","leafHashes":[{"type":"Buffer","data":[0]}]}]
  */
  // tapBip32Derivation?: TapBip32Derivation[];
  tapBip32Derivation?: TapBip32Derivation[];
};

export type IBtcForkUTXO = {
  txid: string;
  vout: number;
  value: BigNumber;
};

export type IBtcInput = {
  txid: string;
  vout: number;
  value: string;
  address: string;
  path: string;
};

export type IBtcOutput = {
  address: string;
  value: string;
  payload?: { isCharge?: boolean; bip44Path?: string; opReturn?: string };
};

export type ICoinSelectUTXO = {
  txId: string;
  vout: number;
  value: number;
  address: string;
  path: string;
  forceSelect?: boolean;
};

export type IUTxoInput = Omit<IUtxoInfo, 'txid'> & {
  txId: string;
};
export type IUtxoOutput = { address: string; value: number };

export type ICoinSelectResultPro = {
  inputs: IUTxoInput[];
  outputs: IUtxoOutput[];
  fee: number;
};

export type IInputsForCoinSelect = ICoinSelectUTXO[];
export type IOutputsForCoinSelect = {
  address: string;
  value?: number;
  isMax?: boolean;
  script?: string;
}[];

export type IEncodedTxBtc = {
  inputs: IBtcInput[];
  outputs: IBtcOutput[];
  inputsForCoinSelect: IInputsForCoinSelect;
  outputsForCoinSelect: IOutputsForCoinSelect;
  fee: string;
  psbtHex?: string;
  inputsToSign?: ITxInputToSign[];
  disabledCoinSelect?: boolean;
};

export type ITxInput = {
  address: string;
  value: BigNumber;
  tokenAddress?: string;
  utxo?: IBtcForkUTXO;
  publicKey?: string;
};

export type ITxOutput = {
  address: string;
  value: BigNumber;
  tokenAddress?: string;
  payload?: { [key: string]: any };
};
