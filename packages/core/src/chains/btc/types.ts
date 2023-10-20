import type { EAddressEncodings } from '../../types';
import type BigNumber from 'bignumber.js';
import type {
  NonWitnessUtxo,
  RedeemScript,
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
};

export type IBtcForkUTXO = {
  txid: string;
  vout: number;
  value: BigNumber;
};
