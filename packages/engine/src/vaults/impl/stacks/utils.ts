/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import BigNumber from 'bignumber.js';
import BN from 'bn.js';

import { InvalidAddress } from '../../../errors';
import { hash160, sha256 } from '../../../secret/hash';
import {
  type IDecodedTx,
  IDecodedTxActionType,
  IDecodedTxDirection,
  IDecodedTxStatus,
  type ISignedTxPro,
  type IUnsignedTxPro,
} from '../../types';

import type { Signer } from '../../../proxy';
import type { Token } from '../../../types/token';
import { IEncodedTxStacks } from './types';

export function verifyStacksAddress(address: string) {
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
    name: 'mainnet',
    alias: 'mainnet',
    prefix: 'stacks',
    pubkeyhash: 0x19,
    privatekey: 0x23,
    scripthash: 0x44,
    xpubkey: 0x42696720,
    xprivkey: 0x426c6b73,
    networkMagic: 0x72271221,
  },
  testnet: {
    name: 'stackstestnet',
    prefix: 'stackstestnet',
    pubkeyhash: 0x6f,
    privatekey: 0xef,
    scripthash: 0xc4,
    xpubkey: 0x043587cf,
    xprivkey: 0x04358394,
    networkMagic: 0xf4e5f3f4,
  },
};

export function getStacksNetworkInfo(chainid: string): {
  name: string;
  prefix: string;
  pubkeyhash: number;
  privatekey: number;
  scripthash: number;
  xpubkey: number;
  xprivkey: number;
  networkMagic: number;
} {
  return chainid === 'testnet' ? NETWORKS.testnet : NETWORKS.mainnet;
}

export function getStacksPrefix(chainId: string): string {
  return getStacksNetworkInfo(chainId).prefix;
}

export function verifyStacksAddressPrefix(address: string) {
  return address.startsWith('stacks:') || address.startsWith('stackstest:');
}

export function sha256sha256(buffer: Buffer): Buffer {
  return sha256(sha256(buffer));
}

const MAXINT = 0xffffffff;
const DEFAULT_SEQNUMBER = MAXINT;
const FEE_PER_KB = 1000 * 3;
const CHANGE_OUTPUT_MAX_SIZE = 1 + 8 + 1 + 23;

export function estimateSize(encodedTx: IEncodedTxStacks) {
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
  encodedTx: IEncodedTxStacks,
  feeRate = FEE_PER_KB / 1000,
): number {
  const size = estimateSize(encodedTx);
  const feeWithChange = Math.ceil(
    size * feeRate + CHANGE_OUTPUT_MAX_SIZE * feeRate,
  );
  return feeWithChange;
}

function buildInputIdemWithSignature({
  sigtype,
  prevTxId,
  scriptBuffer,
  sequenceNumber,
  amount,
}: IStacksInputSignature): Buffer {
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
}: IStacksInputSignature): Buffer {
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
}: IStacksOutputSignature): Buffer {
  return Buffer.concat([
    writeUInt8(outType),
    writeUInt64LEBN(satoshi),
    varintBufNum(scriptBuffer.length),
    scriptBuffer,
  ]);
}

export function buildRawTx(
  inputSignatures: IStacksInputSignature[],
  outputSignatures: IStacksOutputSignature[],
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
  inputSignatures: IStacksInputSignature[],
  outputSignatures: IStacksOutputSignature[],
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

function buildSignatures(
  encodedTx: IEncodedTxStacks,
  dbAccountAddress: string,
) {
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
      `Available balance cannot be less than 0, inputAmount: ${inputAmount.toString()}, dust: ${fee.toString()}`,
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
      sigtype: StacksSignature.SIGHASH_STACKS_ALL,
    })),
  };
}

export function buildSignatureBuffer(
  encodedTx: IEncodedTxStacks,
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
  return {
    signatureBuffer,
    inputSignatures,
    outputSignatures,
  };
}

// signed by 'schnorr'
export async function signEncodedTx(
  unsignedTx: IUnsignedTxPro,
  signer: Signer,
  dbAccountAddress: string,
): Promise<ISignedTxPro> {
  const encodedTx = unsignedTx.encodedTx as IEncodedTxStacks;
  const privateKey = await signer.getPrvkey();
  const publicKey = await signer.getPubkey(true);
  const {
    outputSignatures,
    inputSignatures: inputSigs,
    signatureBuffer,
  } = buildSignatureBuffer(encodedTx, dbAccountAddress);
  const ret = sha256sha256(signatureBuffer);
  const signature = sign(privateKey, ret);
  const inputSignatures: IStacksInputSignature[] = inputSigs.map(
    (inputSig) => ({
      ...inputSig,
      publicKey,
      signature,
      scriptBuffer: buildInputScriptBuffer(publicKey, signature),
    }),
  );

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

export function decodeScriptBufferToStacksAddress(
  buffer: Buffer,
  prefix: string,
) {
  const chunks = decodeScriptBufferToScriptChunks(buffer);
  // lib/script/script.js 1364L
  if (isPublicKeyTemplateIn(chunks) && chunks[0].buf) {
    const constraintHash = hash160(chunks[0].buf);
    const scriptTemplate = scriptChunksToBuffer([
      {
        opcodenum: Opcode.OP_FALSE,
      },
      {
        opcodenum: Opcode.OP_1,
      },
      bufferToScripChunk(constraintHash),
    ]);
    const hashBuffer = convertScriptToPushBuffer(scriptTemplate);
    return encode(prefix, StacksAddressType.PayToScriptTemplate, hashBuffer);
  }
  if (isPublicKeyTemplateOut(chunks) && chunks[2].buf) {
    const scriptTemplate = scriptChunksToBuffer([
      {
        opcodenum: Opcode.OP_FALSE,
      },
      {
        opcodenum: Opcode.OP_1,
      },
      bufferToScripChunk(chunks[2].buf),
    ]);
    const hashBuffer = convertScriptToPushBuffer(scriptTemplate);
    return encode(prefix, StacksAddressType.PayToScriptTemplate, hashBuffer);
  }
  return '';
}

const calDirection = (
  account: string,
  isFromSelf: boolean,
  isToSelf: boolean,
) => {
  if (isFromSelf && isToSelf) {
    return IDecodedTxDirection.SELF;
  }

  if (isFromSelf) {
    return IDecodedTxDirection.OUT;
  }

  if (isToSelf) {
    return IDecodedTxDirection.IN;
  }

  return IDecodedTxDirection.OTHER;
};

export function buildDecodeTxFromTx({
  tx,
  dbAccountAddress,
  addressPrefix,
  decimals,
  token,
  networkId,
  accountId,
}: {
  tx: IStacksTransaction;
  dbAccountAddress: string;
  addressPrefix: string;
  decimals: number;
  token: Token;
  networkId: string;
  accountId: string;
}) {
  const fromAddresses = tx.vin.map((vin) =>
    decodeScriptBufferToStacksAddress(
      Buffer.from(vin.scriptSig.hex, 'hex'),
      addressPrefix,
    ),
  );
  const toAddresses = tx.vout.map((vout) =>
    decodeScriptBufferToStacksAddress(
      Buffer.from(vout.scriptPubKey.hex, 'hex'),
      addressPrefix,
    ),
  );

  const fromAddress = !fromAddresses.includes(dbAccountAddress)
    ? fromAddresses[0]
    : dbAccountAddress;
  const toAddress = fromAddresses.includes(dbAccountAddress)
    ? toAddresses[0]
    : dbAccountAddress;

  const decodedTx: IDecodedTx = {
    txid: tx.txid,
    owner: dbAccountAddress,
    signer: fromAddress,
    nonce: 0,
    actions: tx.vin.map((vin, index) => {
      const amount = new BigNumber(vin.value_satoshi).shiftedBy(
        -token.decimals,
      );
      const from = fromAddresses[index];
      return {
        type: IDecodedTxActionType.TOKEN_TRANSFER,
        direction: calDirection(
          from,
          from === dbAccountAddress,
          toAddress === dbAccountAddress,
        ),
        tokenTransfer: {
          tokenInfo: token,
          from,
          to: toAddress,
          amount: amount.toFixed(),
          amountValue: amount.toFixed(),
          extraInfo: null,
        },
      };
    }),
    outputActions: tx.vout
      .map((vout, index) => {
        const amount = new BigNumber(vout.value_satoshi).shiftedBy(
          -token.decimals,
        );
        const to = toAddresses[index];
        if (fromAddress !== dbAccountAddress && to !== dbAccountAddress) {
          return false;
        }
        return {
          type: IDecodedTxActionType.TOKEN_TRANSFER,
          direction: calDirection(
            to,
            fromAddress === dbAccountAddress,
            to === dbAccountAddress,
          ),
          tokenTransfer: {
            tokenInfo: token,
            from: fromAddress,
            to,
            amount: amount.toFixed(),
            amountValue: amount.toFixed(),
            extraInfo: null,
          },
        };
      })
      .filter(Boolean),
    status: tx.confirmations
      ? IDecodedTxStatus.Confirmed
      : IDecodedTxStatus.Pending,
    networkId,
    accountId,
    extraInfo: null,
    totalFeeInNative: new BigNumber(tx.fee_satoshi)
      .shiftedBy(-decimals)
      .toFixed(),
  };
  decodedTx.updatedAt = tx.time ? tx.time * 1000 : Date.now();
  decodedTx.createdAt = decodedTx.updatedAt;
  decodedTx.isFinal = decodedTx.status === IDecodedTxStatus.Confirmed;
  return decodedTx;
}
