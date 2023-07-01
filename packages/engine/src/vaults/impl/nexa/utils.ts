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
  writeUInt32LE,
  writeUInt64LEBN,
  writeUInt8,
} from './sdk';

import type { Signer } from '../../../proxy';
import type { ISignedTxPro, IUnsignedTxPro } from '../../types';
import type { IEncodedTxNexa } from './types';

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

enum NexaSignature {
  SIGHASH_NEXA_ALL = 0x00,
  SIGHASH_ALL = 0x01,
  SIGHASH_NONE = 0x02,
  SIGHASH_SINGLE = 0x03,
  SIGHASH_FORKID = 0x40,
  SIGHASH_ANYONECANPAY = 0x80,
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
// signed by 'schnorr'
export async function signEncodedTx(
  unsignedTx: IUnsignedTxPro,
  signer: Signer,
): Promise<ISignedTxPro> {
  const privateKey = await signer.getPrvkey();
  const publicKey = await signer.getPubkey(true);
  const scriptPushPublicKey = converToScriptPushBuffer(publicKey);
  const signHash = hash160(scriptPushPublicKey);
  console.error('signHash', signHash.toString('hex'));

  const { encodedTx } = unsignedTx;
  const { inputs, outputs } = encodedTx as IEncodedTxNexa;

  const prevoutsBuffer = Buffer.concat(
    inputs.map((input) =>
      Buffer.concat([
        writeUInt8(0),
        reverseBuffer(Buffer.from(input.txId, 'hex')),
      ]),
    ),
  );
  const prevoutsHash = sha256sha256(prevoutsBuffer);
  console.log('hashPrevoutsHash', prevoutsHash.toString('hex'));

  const sequenceNumberBuffer = Buffer.concat(
    inputs.map((input) =>
      writeUInt32LE(input.sequenceNumber || DEFAULT_SEQNUMBER),
    ),
  );
  const sequenceNumberHash = sha256sha256(sequenceNumberBuffer);
  console.log('sequenceNumberHash', sequenceNumberHash.toString('hex'));

  const inputAmountBuffer = Buffer.concat(
    inputs.map((input) => writeUInt64LEBN(new BN(input.satoshis))),
  );
  const inputAmountHash = sha256sha256(inputAmountBuffer);
  console.log('inputAmountHash', inputAmountHash.toString('hex'));

  const inputAmount: number = inputs.reduce(
    (acc, input) => acc + input.satoshis,
    0,
  );
  const outputAmount = outputs.reduce(
    (acc, output) => acc + Number(output.fee),
    0,
  );
  const available = inputAmount - outputAmount * 100;
  const fee = estimateFee(encodedTx as IEncodedTxNexa, available);
  // change address
  outputs.push({
    address: inputs[0].address,
    fee: String((available - fee) / 100),
    outType: 1,
  });

  const outputBuffer = Buffer.concat(
    // scriptBuffer
    outputs.map((output) => {
      const bfr = getScriptBufferFromScriptTemplateOut(output.address);
      return Buffer.concat([
        // 1: p2pkt outType
        writeUInt8(1),
        writeUInt64LEBN(new BN(Number(output.fee) * 100)),
        varintBufNum(bfr.length),
        bfr,
      ]);
    }),
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
  console.log('subScriptBuffer', subScriptBuffer.toString('hex'));
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
  console.log('sighashForNexa--privateKey', privateKey.toString('hex'));
  console.log('sighashForNexa--ret', ret.toString('hex'));
  const signature = sign(privateKey, ret);
  console.log('signature', Buffer.from(signature).toString('hex'));
  const inputSignatures = inputs.map((input, index) => ({
    publicKey: publicKey.toString('hex'),
    prevTxId: input.txId,
    outputIndex: input.outputIndex,
    inputIndex: index,
    signature,
    sigtype: NexaSignature.SIGHASH_NEXA_ALL,
  }));

  // const txid = buildTxid(inputSignatures);

  console.error(inputSignatures);
  return {
    txid: '',
    rawTx: '',
    encodedTx: unsignedTx.encodedTx,
  };
}
