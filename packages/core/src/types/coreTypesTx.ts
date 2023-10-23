import type BigNumber from 'bignumber.js';
import type { IEncodedTxAda } from '../chains/ada/types';
import type { IEncodedTxCfx } from '../chains/cfx/types';
import type { IEncodedTxCosmos } from '../chains/cosmos/types';
import { IEncodedTxFil } from '../chains/fil/types';
import { IEncodedTxKaspa } from '../chains/kaspa/types';
import { IEncodedTxNexa } from '../chains/nexa/types';
import { IEncodedTxSui } from '../chains/sui/types';
import { IEncodedTxTron } from '../chains/tron/types';
import { IEncodedTxXmr } from '../chains/xmr/types';
import { IEncodedTxXrp } from '../chains/xrp/types';
import type { ICurveName } from './coreTypesBase';

export type IEncodedTx =
  | string
  | IEncodedTxAda
  | IEncodedTxCfx
  | IEncodedTxCosmos
  | IEncodedTxFil
  | IEncodedTxKaspa
  | IEncodedTxSui
  | IEncodedTxXrp
  | IEncodedTxXmr
  | IEncodedTxTron
  | IEncodedTxNexa;
//   | IEncodedTxEvm
//   | IEncodedTxAlgo
//   | IEncodedTxNear
//   | IEncodedTxBtc
//   | IEncodedTxSTC
//   | IEncodedTxAptos
//   | IEncodedTxCfx
//   | IEncodedTxDot
//   | IEncodedTxLightning;

export type INativeTx = object;
//   | INativeTxEvm
//   | INativeTxNear
//   | INativeTxBtc
//   | INativeTxSol;

export type IRawTx = string;

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
  publicKey?: string; // used in stc
};
export type TxOutput = {
  address: string;
  value: BigNumber;
  tokenAddress?: string;
  payload?: { [key: string]: any };
};
export type InputToSign = {
  index: number;
  publicKey: string;
  address: string;
  sighashTypes?: number[];
};
export type UnsignedTx = {
  inputs: TxInput[];
  outputs: TxOutput[];
  type?: string;
  nonce?: number;
  feeLimit?: BigNumber;
  feeLimitForDisplay?: BigNumber;
  feePricePerUnit?: BigNumber;
  payload: { [key: string]: any };
  tokensChangedTo?: { [key: string]: string };
};
export type IUnsignedTxPro = UnsignedTx & {
  encodedTx: IEncodedTx;
  rawTxUnsigned?: string;
  psbtHex?: string;
  inputsToSign?: InputToSign[];
  // signerAccount: ISignerAccountEvm | ISignerAccountNear | ISignerAccountAptos
};
export type SignedTx = {
  txid: string;
  rawTx: string;
  psbtHex?: string;
};
export type SignedTxResult = SignedTx & {
  signatureScheme?: ICurveName;
  signature?: string; // hex string
  publicKey?: string; // hex string
  digest?: string; // hex string
  txKey?: string; // hex string for Monero
  pendingTx?: boolean; // It is used for Aptos to wait for the chain to get the transaction state
  // for lightning network
  nonce?: number;
  randomSeed?: number;
};
export type ISignedTxPro = SignedTxResult & {
  encodedTx?: IEncodedTx;
};
