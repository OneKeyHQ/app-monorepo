/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import BN from 'bn.js';

import {
  ENexaAddressType,
  ENexaOpcode,
  bufferToScripChunk,
  decode,
  decodeScriptBufferToScriptChunks,
  encode,
  getScriptBufferFromScriptTemplateOut,
  isPublicKeyTemplateIn,
  isPublicKeyTemplateOut,
  reverseBuffer,
  scriptChunksToBuffer,
  sign,
  varintBufNum,
  writeInt32LE,
  writeUInt32LE,
  writeUInt64LEBN,
  writeUInt8,
} from '@onekeyhq/core/src/chains/nexa/sdkNexa/sdk';
import { InvalidAddress } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';

import { hash160, sha256 } from '../../../secret';
import { ENexaSignature } from '../types';

import type { ISigner } from '../../../base/ChainSigner';
import type { ISignedTxPro, IUnsignedTxPro } from '../../../types';
import type {
  IEncodedTxNexa,
  INexaInputSignature,
  INexaOutputSignature,
} from '../types';

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

export function getNexaNetworkInfo(chanid: string): {
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

export function getNexaPrefix(chanid: string): string {
  return getNexaNetworkInfo(chanid).prefix;
}

function convertScriptToPushBuffer(key: Buffer): Buffer {
  const templateChunk = bufferToScripChunk(key);
  return scriptChunksToBuffer([templateChunk]);
}

export function publickeyToAddress(
  publicKey: Buffer,
  chainId: string,
  type: ENexaAddressType = ENexaAddressType.PayToScriptTemplate,
): string {
  const network = getNexaNetworkInfo(chainId);
  let hashBuffer: Buffer;
  if (type === ENexaAddressType.PayToPublicKeyHash) {
    hashBuffer = hash160(publicKey);
  } else if (type === ENexaAddressType.PayToScriptTemplate) {
    const templateChunk = bufferToScripChunk(publicKey);
    const scriptBuffer = scriptChunksToBuffer([templateChunk]);
    const constraintHash = hash160(scriptBuffer);
    const chunks = [
      { opcodenum: ENexaOpcode.OP_FALSE },
      { opcodenum: ENexaOpcode.OP_1 },
      bufferToScripChunk(constraintHash),
    ];
    hashBuffer = scriptChunksToBuffer([
      bufferToScripChunk(scriptChunksToBuffer(chunks)),
    ]);
  } else {
    throw new InvalidAddress();
  }
  return encode(network.prefix, type, hashBuffer);
}

export function verifyNexaAddressPrefix(address: string) {
  return address.startsWith('nexa:') || address.startsWith('nexatest:');
}

export function getDisplayAddress({
  address,
  chainId,
}: {
  address: string;
  chainId: string;
}): string {
  if (verifyNexaAddressPrefix(address)) {
    return address;
  }
  return publickeyToAddress(Buffer.from(address, 'hex'), chainId);
}

export function sha256sha256(buffer: Buffer): Buffer {
  return sha256(sha256(buffer));
}

const MAXINT = 0xffffffff;
const DEFAULT_SEQNUMBER = MAXINT;
const FEE_PER_KB = 1000 * 3;
const CHANGE_OUTPUT_MAX_SIZE = 1 + 8 + 1 + 23;

export function estimateSize(encodedTx: IEncodedTxNexa) {
  let estimatedSize = 4 + 1; // locktime + version
  estimatedSize += encodedTx.inputs.length < 253 ? 1 : 3;
  encodedTx.inputs.forEach(() => {
    // type + outpoint + scriptlen + script + sequence + amount
    estimatedSize += 1 + 32 + 1 + 100 + 4 + 8;
  });
  encodedTx.outputs.forEach((output) => {
    const bfr = getScriptBufferFromScriptTemplateOut(output.address);
    estimatedSize += convertScriptToPushBuffer(bfr).length + 1 + 8 + 1;
  });
  return estimatedSize;
}

export function estimateFee(
  encodedTx: IEncodedTxNexa,
  feeRate = FEE_PER_KB / 1000,
): number {
  const size = estimateSize(encodedTx);
  const feeWithChange = Math.ceil(
    size * feeRate + CHANGE_OUTPUT_MAX_SIZE * feeRate,
  );
  return feeWithChange;
}

export function buildInputScriptBuffer(publicKey: Buffer, signature: Buffer) {
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

export function buildRawTx(
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

export function buildTxid(
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
        Buffer.concat([scriptBuffer, writeUInt8(ENexaOpcode.OP_INVALIDOPCODE)]),
      ),
    ),
  ]);

  const satisfierHash = sha256sha256(satisfierBuffer);
  const txIdHash = reverseBuffer(
    sha256sha256(Buffer.concat([idemHash, satisfierHash])),
  ).toString('hex');
  return txIdHash;
}

function buildSignatures(encodedTx: IEncodedTxNexa, dbAccountAddress: string) {
  const { inputs, outputs, gas } = encodedTx;
  const newOutputs = outputs.slice();
  const inputAmount: BN = inputs.reduce(
    (acc, input) => acc.add(new BN(input.satoshis)),
    new BN(0),
  );
  const outputAmount: BN = newOutputs.reduce(
    (acc, output) => acc.add(new BN(output.satoshis)),
    new BN(0),
  );

  const fee = new BN(gas || estimateFee(encodedTx));
  const available = inputAmount.sub(fee);
  if (available.lt(new BN(0))) {
    console.error(inputAmount.toString(), fee.toString());
    throw new Error(
      appLocale.intl.formatMessage(
        { id: ETranslations.feedback_account_balance_not_equal_to_utxos },
        {
          amount: inputAmount.toString(),
          dust: fee.toString(),
        },
      ),
    );
  }

  if (available.gt(outputAmount)) {
    // change address
    newOutputs.push({
      address: dbAccountAddress,
      satoshis: available.sub(outputAmount).toString(),
      outType: 1,
    });
  } else {
    newOutputs[0].satoshis = available.gt(outputAmount)
      ? newOutputs[0].satoshis
      : available.toString();
  }

  const outputSignatures = newOutputs.map((output) => ({
    address: output.address,
    satoshi: new BN(output.satoshis),
    outType: 1,
    scriptBuffer: getScriptBufferFromScriptTemplateOut(output.address),
  }));

  return {
    outputSignatures,
    inputSignatures: inputs.map((input, index) => ({
      prevTxId: input.txId,
      outputIndex: input.outputIndex,
      inputIndex: index,
      sequenceNumber: input.sequenceNumber || DEFAULT_SEQNUMBER,
      amount: new BN(input.satoshis),
      sigtype: ENexaSignature.SIGHASH_NEXA_ALL,
    })),
  };
}

export function buildSignatureBuffer(
  encodedTx: IEncodedTxNexa,
  dbAccountAddress: string,
) {
  const { inputs } = encodedTx;
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

  const { outputSignatures, inputSignatures } = buildSignatures(
    encodedTx,
    dbAccountAddress,
  );

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
      opcodenum: ENexaOpcode.OP_FROMALTSTACK,
    },
    {
      opcodenum: ENexaOpcode.OP_CHECKSIGVERIFY,
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
  return {
    signatureBuffer,
    inputSignatures,
    outputSignatures,
  };
}

// signed by 'schnorr'
export async function signEncodedTx(
  unsignedTx: IUnsignedTxPro,
  signer: ISigner,
  dbAccountAddress: string,
): Promise<ISignedTxPro> {
  checkIsDefined(dbAccountAddress);
  const encodedTx = unsignedTx.encodedTx as IEncodedTxNexa;
  const privateKey = await signer.getPrvkey();
  const publicKey = await signer.getPubkey(true);
  const {
    outputSignatures,
    inputSignatures: inputSigs,
    signatureBuffer,
  } = buildSignatureBuffer(encodedTx, dbAccountAddress);
  const ret = sha256sha256(signatureBuffer);
  const signature = sign(privateKey, ret);
  const inputSignatures: INexaInputSignature[] = inputSigs.map((inputSig) => ({
    ...inputSig,
    publicKey,
    signature,
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

export function decodeScriptBufferToNexaAddress(
  buffer: Buffer,
  prefix: string,
) {
  const chunks = decodeScriptBufferToScriptChunks(buffer);
  // lib/script/script.js 1364L
  if (isPublicKeyTemplateIn(chunks) && chunks[0].buf) {
    const constraintHash = hash160(chunks[0].buf);
    const scriptTemplate = scriptChunksToBuffer([
      {
        opcodenum: ENexaOpcode.OP_FALSE,
      },
      {
        opcodenum: ENexaOpcode.OP_1,
      },
      bufferToScripChunk(constraintHash),
    ]);
    const hashBuffer = convertScriptToPushBuffer(scriptTemplate);
    return encode(prefix, ENexaAddressType.PayToScriptTemplate, hashBuffer);
  }
  if (isPublicKeyTemplateOut(chunks) && chunks[2].buf) {
    const scriptTemplate = scriptChunksToBuffer([
      {
        opcodenum: ENexaOpcode.OP_FALSE,
      },
      {
        opcodenum: ENexaOpcode.OP_1,
      },
      bufferToScripChunk(chunks[2].buf),
    ]);
    const hashBuffer = convertScriptToPushBuffer(scriptTemplate);
    return encode(prefix, ENexaAddressType.PayToScriptTemplate, hashBuffer);
  }
  return '';
}
