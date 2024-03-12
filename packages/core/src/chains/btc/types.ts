import type BigNumber from 'bignumber.js';
import type {
  NonWitnessUtxo,
  RedeemScript,
  TapInternalKey,
  WitnessUtxo,
} from 'bip174/src/lib/interfaces';
import type { Network, Signer } from 'bitcoinjs-lib';
import type { EAddressEncodings } from '../../types';
import { IUtxoInfo } from '@onekeyhq/kit-bg/src/vaults/types';

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
