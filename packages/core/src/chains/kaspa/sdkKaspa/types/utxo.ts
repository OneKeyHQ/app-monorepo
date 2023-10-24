import { Transaction } from '@kaspa/core-lib';

export interface UnspentOutputInfo {
  txid: string;
  address: string;
  vout: number;
  scriptPubKey: string;
  satoshis: number;
  blockDaaScore: number;
  scriptPublicKeyVersion: number;
}

export interface IUnspentOutput extends Transaction.UnspentOutput {
  readonly blockDaaScore: number;
  readonly scriptPublicKeyVersion: number;
  readonly id: string;
  readonly signatureOPCount: number;
  readonly mass: number;
  readonly scriptPubKey: string;
}

export class UnspentOutput extends Transaction.UnspentOutput {
  readonly blockDaaScore: number;

  readonly id: string;

  readonly mass: number;

  readonly scriptPubKey: string;

  readonly scriptPublicKeyVersion: number;

  readonly signatureOPCount: number;

  constructor(o: UnspentOutputInfo) {
    super(o);
    this.blockDaaScore = o.blockDaaScore;
    this.scriptPublicKeyVersion = o.scriptPublicKeyVersion;
    this.id = `${this.txId}${this.outputIndex}`;
    this.signatureOPCount = this.script.getSignatureOperationsCount();
    this.mass = this.signatureOPCount * Transaction.MassPerSigOp;
    this.mass += 151 * Transaction.MassPerTxByte; // standalone mass
    this.scriptPubKey = o.scriptPubKey;
  }

  // toJSON
  toJSON() {
    return {
      txid: this.txId,
      address: this.address.toString(),
      vout: this.outputIndex,
      scriptPubKey: this.scriptPubKey,
      satoshis: this.satoshis,
      blockDaaScore: this.blockDaaScore,
      scriptPublicKeyVersion: this.scriptPublicKeyVersion,
    };
  }

  // fromJSON
  static fromJSON(json: UnspentOutputInfo) {
    return new UnspentOutput(json);
  }
}
