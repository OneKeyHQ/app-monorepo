/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { schnorr } from '@noble/secp256k1';
import { InvalidAddressError } from 'bchaddrjs';
import BN from 'bn.js';

import { hash160, sha256 } from '../../../secret/hash';

import {
  NexaAddressType,
  Opcode,
  bufferToScripChunk,
  decode,
  encode,
  getScriptBufferFromScriptTemplateOut,
  reverseBuffer,
  scriptChunksToBuffer,
  sign,
  varintBufNum,
  writeInt32LE,
  writeUInt32LE,
  writeUInt64LEBN,
  writeUInt8,
} from './sdk';
import { type IEncodedTxNexa, NexaSignature } from './types';

import type { Signer } from '../../../proxy';
import type { DBAccount } from '../../../types/account';
import type { ISignedTxPro, IUnsignedTxPro } from '../../types';
import type { INexaInputSignature, INexaOutputSignature } from './types';

export function verifyNexaAddress(address: string) {
  try {
    decode(address);
    return {
      isValid: true,
      normalizedAddress: address,
    };
  } catch (error) {
    return {
      isValid: false,
    };
  }
}

const NETWORKS = {
  mainnet: {
    name: 'livenet',
    alias: 'mainnet',
    prefix: 'nexa',
    pubkeyhash: 0x19,
    privatekey: 0x23,
    scripthash: 0x44,
    xpubkey: 0x42696720,
    xprivkey: 0x426c6b73,
    networkMagic: 0x72271221,
  },
  testnet: {
    name: 'nexatest',
    prefix: 'nexatest',
    pubkeyhash: 0x6f,
    privatekey: 0xef,
    scripthash: 0xc4,
    xpubkey: 0x043587cf,
    xprivkey: 0x04358394,
    networkMagic: 0xf4e5f3f4,
  },
};

function getNetworkInfo(chanid: string): {
  name: string;
  prefix: string;
  pubkeyhash: number;
  privatekey: number;
  scripthash: number;
  xpubkey: number;
  xprivkey: number;
  networkMagic: number;
} {
  return chanid === 'testnet' ? NETWORKS.testnet : NETWORKS.mainnet;
}

function converToScriptPushBuffer(key: Buffer): Buffer {
  const templateChunk = bufferToScripChunk(key);
  return scriptChunksToBuffer([templateChunk]);
}

export function publickeyToAddress(
  publicKey: Buffer,
  chainId: string,
  type: NexaAddressType = NexaAddressType.PayToScriptTemplate,
): string {
  const network = getNetworkInfo(chainId);
  let hashBuffer: Buffer;
  if (type === NexaAddressType.PayToPublicKeyHash) {
    hashBuffer = hash160(publicKey);
  } else if (type === NexaAddressType.PayToScriptTemplate) {
    const templateChunk = bufferToScripChunk(publicKey);
    const scriptBuffer = scriptChunksToBuffer([templateChunk]);
    const constraintHash = hash160(scriptBuffer);
    const chunks = [
      { opcodenum: Opcode.OP_FALSE },
      { opcodenum: Opcode.OP_1 },
      bufferToScripChunk(constraintHash),
    ];
    hashBuffer = scriptChunksToBuffer([
      bufferToScripChunk(scriptChunksToBuffer(chunks)),
    ]);
  } else {
    throw new InvalidAddressError();
  }
  return encode(network.prefix, type, hashBuffer);
}

function sha256sha256(buffer: Buffer): Buffer {
  return sha256(sha256(buffer));
}

const MAXINT = 0xffffffff;
const DEFAULT_SEQNUMBER = MAXINT;
const FEE_PER_KB = 1000 * 3;
const CHANGE_OUTPUT_MAX_SIZE = 1 + 8 + 1 + 23;

function estimateFee(encodedTx: IEncodedTxNexa, available: number): number {
  let estimatedSize = 4 + 1; // locktime + version
  estimatedSize += encodedTx.inputs.length < 253 ? 1 : 3;
  encodedTx.inputs.forEach((input) => {
    // type + outpoint + scriptlen + script + sequence + amount
    estimatedSize += 1 + 32 + 1 + 100 + 4 + 8;
  });
  encodedTx.outputs.forEach((output) => {
    const bfr = getScriptBufferFromScriptTemplateOut(output.address);
    estimatedSize += converToScriptPushBuffer(bfr).length + 1 + 8 + 1;
  });
  // const feeRate = this._feePerByte || (this._feePerKb || Transaction.FEE_PER_KB) / 1000
  const feeRate = FEE_PER_KB / 1000;
  const feeWithChange = Math.ceil(
    estimatedSize * feeRate + CHANGE_OUTPUT_MAX_SIZE * feeRate,
  );
  return feeWithChange;
}

function buildInputScriptBuffer(publicKey: Buffer, signature: Buffer) {
  const scriptBuffer = scriptChunksToBuffer([
    bufferToScripChunk(scriptChunksToBuffer([bufferToScripChunk(publicKey)])),
    bufferToScripChunk(signature),
  ]);
  return scriptBuffer;
}

function buildInputIdemWithSignature({
  sigtype,
  prevTxId,
  scriptBuffer,
  sequenceNumber,
  amount,
}: INexaInputSignature): Buffer {
  return Buffer.concat([
    writeUInt8(sigtype),
    reverseBuffer(prevTxId),
    varintBufNum(scriptBuffer.length),
    scriptBuffer,
    writeUInt32LE(sequenceNumber),
    writeUInt64LEBN(amount),
  ]);
}

function buildInputIdem({
  sigtype,
  prevTxId,
  sequenceNumber,
  amount,
}: INexaInputSignature): Buffer {
  return Buffer.concat([
    writeUInt8(sigtype),
    reverseBuffer(prevTxId),
    writeUInt32LE(sequenceNumber),
    writeUInt64LEBN(amount),
  ]);
}

function buildOutputIdem({
  outType,
  satoshi,
  scriptBuffer,
}: INexaOutputSignature): Buffer {
  return Buffer.concat([
    writeUInt8(outType),
    writeUInt64LEBN(satoshi),
    varintBufNum(scriptBuffer.length),
    scriptBuffer,
  ]);
}

function buildRawTx(
  inputSignatures: INexaInputSignature[],
  outputSignatures: INexaOutputSignature[],
  nLockTime = 0,
  isSignature = false,
) {
  const inputIdem = Buffer.concat(
    inputSignatures.map(
      isSignature ? buildInputIdemWithSignature : buildInputIdem,
    ),
  );
  const outputIdem = Buffer.concat(outputSignatures.map(buildOutputIdem));
  const idemBuffer = Buffer.concat([
    // Transaction version
    writeUInt8(0),
    varintBufNum(inputSignatures.length),
    inputIdem,
    varintBufNum(outputSignatures.length),
    outputIdem,
    writeUInt32LE(nLockTime),
  ]);
  return idemBuffer;
}

function buildTxid(
  inputSignatures: INexaInputSignature[],
  outputSignatures: INexaOutputSignature[],
  nLockTime = 0,
): string {
  // build input Idem buffer
  // const inputIdem = Buffer.concat(inputSignatures.map(buildInputIdem));
  // const outputIdem = Buffer.concat(outputSignatures.map(buildOutputIdem));

  // const idemBuffer = Buffer.concat([
  //   // Transaction version
  //   writeUInt8(0),
  //   varintBufNum(inputSignatures.length),
  //   inputIdem,
  //   varintBufNum(outputSignatures.length),
  //   outputIdem,
  //   writeUInt32LE(nLockTime),
  // ]);
  const idemBuffer = buildRawTx(inputSignatures, outputSignatures, nLockTime);
  const idemHash = sha256sha256(idemBuffer);

  const satisfierBuffer = Buffer.concat([
    writeInt32LE(inputSignatures.length),
    Buffer.concat(
      inputSignatures.map(({ scriptBuffer }) =>
        Buffer.concat([scriptBuffer, writeUInt8(Opcode.OP_INVALIDOPCODE)]),
      ),
    ),
  ]);

  const satisfierHash = sha256sha256(satisfierBuffer);
  const txIdHash = reverseBuffer(
    sha256sha256(Buffer.concat([idemHash, satisfierHash])),
  ).toString('hex');
  return txIdHash;
}

// signed by 'schnorr'
export async function signEncodedTx(
  unsignedTx: IUnsignedTxPro,
  signer: Signer,
  dbAccount: DBAccount,
): Promise<ISignedTxPro> {
  const privateKey = await signer.getPrvkey();
  const publicKey = await signer.getPubkey(true);
  const scriptPushPublicKey = converToScriptPushBuffer(publicKey);
  const signHash = hash160(scriptPushPublicKey);
  const { encodedTx } = unsignedTx;
  const { inputs, outputs } = encodedTx as IEncodedTxNexa;
  const newOutputs = outputs.slice();
  const prevoutsBuffer = Buffer.concat(
    inputs.map((input) =>
      Buffer.concat([
        writeUInt8(0),
        reverseBuffer(Buffer.from(input.txId, 'hex')),
      ]),
    ),
  );
  const prevoutsHash = sha256sha256(prevoutsBuffer);

  const sequenceNumberBuffer = Buffer.concat(
    inputs.map((input) =>
      writeUInt32LE(input.sequenceNumber || DEFAULT_SEQNUMBER),
    ),
  );
  const sequenceNumberHash = sha256sha256(sequenceNumberBuffer);

  const inputAmountBuffer = Buffer.concat(
    inputs.map((input) => writeUInt64LEBN(new BN(input.satoshis))),
  );
  const inputAmountHash = sha256sha256(inputAmountBuffer);

  const inputAmount: number = inputs.reduce(
    (acc, input) => acc + input.satoshis,
    0,
  );
  const outputAmount = newOutputs.reduce(
    (acc, output) => acc + Number(output.fee),
    0,
  );
  const available = inputAmount - outputAmount * 100;
  const fee = estimateFee(encodedTx as IEncodedTxNexa, available);

  // change address
  newOutputs.push({
    address: dbAccount.address,
    fee: String((available - fee) / 100),
    outType: 1,
  });

  const outputSignatures: INexaOutputSignature[] = newOutputs.map((output) => ({
    address: output.address,
    satoshi: new BN(Number(output.fee) * 100),
    outType: 1,
    scriptBuffer: getScriptBufferFromScriptTemplateOut(output.address),
  }));

  const outputBuffer = Buffer.concat(
    // scriptBuffer
    outputSignatures.map((output) =>
      Buffer.concat([
        // 1: p2pkt outType
        writeUInt8(output.outType),
        writeUInt64LEBN(new BN(output.satoshi)),
        varintBufNum(output.scriptBuffer.length),
        output.scriptBuffer,
      ]),
    ),
  );
  const outputHash = sha256sha256(outputBuffer);
  const subScriptBuffer = scriptChunksToBuffer([
    {
      opcodenum: Opcode.OP_FROMALTSTACK,
    },
    {
      opcodenum: Opcode.OP_CHECKSIGVERIFY,
    },
  ]);
  const signatureBuffer = Buffer.concat([
    // transaction.version
    writeUInt8(0),
    prevoutsHash,
    inputAmountHash,
    sequenceNumberHash,
    varintBufNum(subScriptBuffer.length),
    subScriptBuffer,
    outputHash,
    // transaction.nLockTime
    writeUInt32LE(0),
    // sighashType
    writeUInt8(0),
  ]);
  const ret = reverseBuffer(sha256sha256(signatureBuffer));
  const signature = sign(privateKey, ret);
  const inputSignatures: INexaInputSignature[] = inputs.map((input, index) => ({
    publicKey,
    prevTxId: input.txId,
    outputIndex: input.outputIndex,
    inputIndex: index,
    signature,
    sequenceNumber: input.sequenceNumber || DEFAULT_SEQNUMBER,
    amount: new BN(input.satoshis),
    sigtype: NexaSignature.SIGHASH_NEXA_ALL,
    scriptBuffer: buildInputScriptBuffer(publicKey, signature),
  }));

  const txid = buildTxid(inputSignatures, outputSignatures);
  const rawTx = buildRawTx(inputSignatures, outputSignatures, 0, true);
  return {
    txid,
    rawTx: rawTx.toString('hex'),
    signature: signature.toString('hex'),
    digest: ret.toString('hex'),
    encodedTx,
  };
}
