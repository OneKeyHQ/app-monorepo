/* eslint-disable @typescript-eslint/naming-convention */
import { Transaction, crypto } from '@kaspa/core-lib';
import { bytesToHex } from '@noble/hashes/utils';
import * as necc from '@noble/secp256k1';
import BigNumber from 'bignumber.js';

import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';

import ecc from '../../../secret/nobleSecp256k1Wrapper';

import { DEFAULT_SEQNUMBER } from './constant';
import { UnspentOutput } from './types';

import type {
  SubmitTransactionRequest,
  TransactionInput,
  TransactionOutput,
} from './types';
import type { IEncodedTxKaspa, IKaspaSigner } from '../types';
import type { Script } from '@kaspa/core-lib';

export enum SignatureType {
  SIGHASH_ALL = 0x01,
  SIGHASH_NONE = 0x02,
  SIGHASH_SINGLE = 0x03,
  SIGHASH_FORKID = 0x40,
  SIGHASH_ANYONECANPAY = 0x80,
}

export enum SigningMethodType {
  ECDSA = 'ecdsa',
  Schnorr = 'schnorr',
}

export function toTransaction(tx: IEncodedTxKaspa): Transaction {
  const { inputs, outputs, mass } = tx;

  const { address: from } = inputs[0] || {};
  const { address: to, value } = outputs[0];

  let sendAmount = new BigNumber(value);
  if (tx.hasMaxSend) {
    sendAmount = sendAmount.minus(mass);
  }

  if (sendAmount.isLessThan(0)) {
    throw new OneKeyInternalError({
      message: 'Insufficient Balance.',
      key: 'msg__insufficient_balance',
    });
  }

  const txn = new Transaction()
    .from(inputs.map((input) => new UnspentOutput(input)))
    .to(to, sendAmount.toNumber())
    .setVersion(0)
    .fee(mass)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
    .change(from?.toString());

  // pending kaspa-core fix sequence field type
  txn.inputs.forEach((input) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
    input.sequenceNumber = DEFAULT_SEQNUMBER;
  });

  return txn;
}

async function sign(
  transaction: Transaction,
  signer: IKaspaSigner,
  sighashType: SignatureType,
  inputIndex: number,
  subscript: Script,
  satoshisBN: number,
  flags: number | undefined,
  signingMethod: SigningMethodType,
) {
  // @ts-expect-error
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
  const hashbuf = Transaction.Sighash.sighash(
    transaction,
    sighashType,
    inputIndex,
    subscript,
    satoshisBN,
    flags,
  );

  if (signingMethod === 'schnorr') {
    // @ts-ignore
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const privateKey = (await signer.getPrivateKey()).toBuffer();
    const signatureBuffer = ecc.signSchnorr(hashbuf, privateKey);
    const signature = bytesToHex(signatureBuffer);

    // const verify = necc.schnorr.verifySync(
    //   signature,
    //   bytesToHex(hashbuf),
    //   bytesToHex(signer.getPublicKey().toBuffer()),
    // );

    const sig = crypto.Signature.fromString(hexUtils.stripHexPrefix(signature));
    // @ts-expect-error
    const b = sig.toBuffer('schnorr').toString('hex');
    if (b.length < 128)
      throw new Error(
        `Invalid Signature\nsecp256k1 sig:${hexUtils.hexlify(
          signature,
        )}\nSignature.fromString:${b}`,
      );
    sig.compressed = true;
    // @ts-expect-error
    sig.nhashtype = sighashType;

    return sig;
  }

  if (signingMethod === 'ecdsa') {
    const signatureBuffer = await necc.sign(
      hashbuf,
      // @ts-ignore
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      (await signer.getPrivateKey()).toBuffer(),
    );
    const signature = hexUtils.hexlify(signatureBuffer);

    const sig = crypto.Signature.fromString(hexUtils.stripHexPrefix(signature));
    sig.compressed = true;
    // @ts-expect-error
    sig.nhashtype = sighashType;

    return sig;
  }
}

async function getSignaturesWithInput(
  transaction: Transaction,
  input: Transaction.Input,
  index: number,
  signer: IKaspaSigner,
  // eslint-disable-next-line no-bitwise
  sigtype: SignatureType = SignatureType.SIGHASH_ALL |
    SignatureType.SIGHASH_FORKID,
  signingMethod: SigningMethodType = SigningMethodType.Schnorr,
) {
  // @ts-expect-error
  if (input instanceof Transaction.Input.PublicKey) {
    const publicKey = signer.getPublicKey();

    if (
      publicKey.toString() ===
      hexUtils.hexlify(
        // @ts-ignore
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        input?.output?.script?.getPublicKey(),
        {
          noPrefix: true,
        },
      )
    ) {
      const txSign = await sign(
        transaction,
        signer,
        sigtype,
        index,
        // @ts-expect-error
        input.output?.script,
        input.output?.satoshis,
        undefined,
        signingMethod,
      );

      return [
        // @ts-expect-error
        new Transaction.Signature({
          publicKey,
          prevTxId: input.prevTxId,
          outputIndex: input.outputIndex,
          inputIndex: index,
          signature: txSign,
          sigtype,
        }),
      ];
    }
    return [];
  }
}

async function getSignatures(
  signer: IKaspaSigner,
  list: InputWithIndex[],
  transaction: Transaction,
  // eslint-disable-next-line no-bitwise
  sigtype: SignatureType = SignatureType.SIGHASH_ALL |
    SignatureType.SIGHASH_FORKID,
  signingMethod: SigningMethodType = SigningMethodType.Schnorr,
) {
  // By default, signs using ALL|FORKID
  const results = [];

  let sigs;

  for (const { input, index } of list) {
    sigs =
      (await getSignaturesWithInput(
        transaction,
        input,
        index,
        signer,
        sigtype,
        signingMethod,
      )) || [];
    results.push(...sigs);
  }

  return results;
}

async function _sign(
  signer: IKaspaSigner,
  list: InputWithIndex[],
  transaction: Transaction,
  sigtype: SignatureType,
  signingMethod: SigningMethodType = SigningMethodType.ECDSA,
) {
  const signatures =
    (await getSignatures(signer, list, transaction, sigtype, signingMethod)) ||
    [];

  // applySignature
  for (const signature of signatures) {
    // @ts-expect-error
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
    transaction.inputs[signature.inputIndex].addSignature(
      transaction,
      signature,
      signingMethod,
    );
  }

  return transaction.toBuffer().toString('hex');
}

type InputWithIndex = { input: Transaction.Input; index: number };

export function signTransaction(
  transaction: Transaction,
  signer: IKaspaSigner,
): Promise<string> {
  const list: InputWithIndex[] = [];

  for (let i = 0; i < transaction.inputs.length; i += 1) {
    const input = transaction.inputs[i];
    list.push({ input, index: i });
  }

  return _sign(
    signer,
    list,
    transaction,
    SignatureType.SIGHASH_ALL,
    SigningMethodType.Schnorr,
  );
}

export function transactionFromString(hex: string): Transaction {
  return new Transaction(hex);
}

export function submitTransactionFromString(
  hex: string,
): SubmitTransactionRequest {
  const tx = new Transaction(hex);

  const { nLockTime: lockTime, version } = tx;
  const inputs: TransactionInput[] = tx.inputs.map(
    (input: Transaction.Input) => ({
      previousOutpoint: {
        transactionId: input.prevTxId.toString('hex'),
        index: input.outputIndex,
      },
      signatureScript: input.script.toBuffer().toString('hex'),
      sequence: DEFAULT_SEQNUMBER, // input.sequenceNumber,
      sigOpCount: 1,
    }),
  );

  const outputs: TransactionOutput[] = tx.outputs.map(
    (output: Transaction.Output) => ({
      amount: output.satoshis,
      scriptPublicKey: {
        scriptPublicKey: output.script.toBuffer().toString('hex'),
        version: 0,
      },
    }),
  );

  return {
    transaction: {
      version,
      inputs,
      outputs,
      lockTime,
      // payloadHash:
      //   '0000000000000000000000000000000000000000000000000000000000000000',
      // subnetworkId: networkId,

      // @ts-expect-error
      // eslint-disable-next-line @typescript-eslint/unbound-method,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
      // fee: tx.getStandaloneMass().mass,

      // eslint-disable-next-line @typescript-eslint/unbound-method
      fee: tx.fee,
      subnetworkId: '0000000000000000000000000000000000000000',
      // gas: 0
    },
  };
}
