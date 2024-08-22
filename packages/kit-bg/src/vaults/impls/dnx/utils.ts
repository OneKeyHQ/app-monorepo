/* eslint-disable no-param-reassign */
/* eslint-disable no-bitwise */
import { keccak256 } from '@ethersproject/keccak256';
import { BigInteger } from 'biginteger';
import BigNumber from 'bignumber.js';

import type {
  IEncodedTxDnx,
  ISignTxParams,
} from '@onekeyhq/core/src/chains/dnx/types';

import type { DnxSignature } from '@onekeyfe/hd-core';

const CRYPTONOTE_PUBLIC_ADDRESS_BASE58_PREFIX = 185;
const CRYPTONOTE_PUBLIC_INTEGRATED_ADDRESS_BASE58_PREFIX = 29;
const CRYPTONOTE_PUBLIC_SUBADDRESS_BASE58_PREFIX = 52;

export function encodeVarInt(number: number) {
  // eslint-disable-next-line spellcheck/spell-checker
  // Here, we follow the implementation of the js demo provided by dnx. We must follow this method to calculate the correct value (if we use bignumber to calculate, the result will be incorrect when the value exceeds a certain value). The dnx demo has modified the biginteger, and we have implemented it with a patch.
  let numberBI = new BigInteger(number);
  let out = '';
  while (numberBI.compare(0x80) >= 0) {
    out += `0${((numberBI.lowVal() & 0x7f) | 0x80).toString(16)}`.slice(-2);
    numberBI = numberBI.divide(new BigInteger(2).pow(7));
  }
  out += `0${numberBI.toJSValue().toString(16)}`.slice(-2);
  return out;
}

export function integerToLittleEndianHex({
  number,
  bytes,
}: {
  number: number;
  bytes: number;
}) {
  let hexString: string = number.toString(16);
  if (hexString.length % 2 !== 0) {
    hexString = `0${hexString}`;
  }
  while (hexString.length / 2 < bytes) {
    hexString = `00${hexString}`;
  }
  const littleEndianHex: string = (hexString.match(/.{2}/g) ?? [])
    .reverse()
    .join('');
  return littleEndianHex;
}

export function hexToBin(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error('Hex string has invalid length!');
  const result = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length / 2; i += 1) {
    result[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return result;
}

export function validHex(hex: string) {
  const exp = new RegExp(`[0-9a-fA-F]{${hex.length}}`);
  return exp.test(hex);
}

export function cnFastHash(input: string): string {
  if (input.length % 2 !== 0 || !validHex(input)) {
    throw new Error('Input invalid');
  }
  return keccak256(hexToBin(input));
}

export function strToBin(str: string): Uint8Array {
  const res = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i += 1) {
    res[i] = str.charCodeAt(i);
  }
  return res;
}

export function binToHex(bin: Uint8Array): string {
  const out: string[] = [];
  for (let i = 0; i < bin.length; i += 1) {
    out.push(`0${bin[i].toString(16)}`.slice(-2));
  }
  return out.join('');
}

export function uint64To8be(
  num: BigNumber | number | string,
  size: number,
): Uint8Array {
  let numBN = new BigNumber(num);
  const res: Uint8Array = new Uint8Array(size);
  if (size < 1 || size > 8) {
    throw new Error('Invalid input length');
  }
  const twopow8 = new BigNumber(2).pow(8);
  for (let i = size - 1; i >= 0; i -= 1) {
    res[i] = numBN.mod(twopow8).toNumber();
    numBN = numBN.dividedToIntegerBy(twopow8);
  }
  return res;
}

export function cnBase58Decode(address: string) {
  const alphabetStr =
    '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

  const alphabet: number[] = [];
  for (let i = 0; i < alphabetStr.length; i += 1) {
    alphabet.push(alphabetStr.charCodeAt(i));
  }

  const encodedBlockSizes: number[] = [0, 2, 3, 5, 6, 7, 9, 10, 11];

  const alphabetSize = alphabet.length;
  const fullBlockSize = 8;
  const fullEncodedBlockSize = 11;
  const UINT64_MAX = new BigNumber(2).pow(64);

  const decodeBlock = function (
    data: Uint8Array,
    buf: Uint8Array,
    index: number,
  ): Uint8Array {
    if (data.length < 1 || data.length > fullEncodedBlockSize) {
      throw new Error(`Invalid block length: ${data.length}`);
    }

    const resSize: number = encodedBlockSizes.indexOf(data.length);
    if (resSize <= 0) {
      throw new Error('Invalid block size');
    }
    let resNum = new BigNumber(0);
    let order = new BigNumber(1);
    for (let i = data.length - 1; i >= 0; i -= 1) {
      const digit: number = alphabet.indexOf(data[i]);
      if (digit < 0) {
        throw new Error('Invalid symbol');
      }
      const product = order.multipliedBy(digit).plus(resNum);
      // if product > UINT64_MAX
      if (product.comparedTo(UINT64_MAX) === 1) {
        throw new Error('Overflow');
      }
      resNum = product;
      order = order.multipliedBy(alphabetSize);
    }
    if (
      resSize < fullBlockSize &&
      new BigNumber(2).pow(8 * resSize).comparedTo(resNum) <= 0
    ) {
      throw new Error('Overflow 2');
    }
    buf.set(uint64To8be(resNum, resSize), index);
    return buf;
  };

  const addressArray = strToBin(address);
  if (addressArray.length === 0) {
    return '';
  }
  const fullBlockCount: number = Math.floor(
    addressArray.length / fullEncodedBlockSize,
  );
  const lastBlockSize: number = addressArray.length % fullEncodedBlockSize;
  const lastBlockDecodedSize: number = encodedBlockSizes.indexOf(lastBlockSize);
  if (lastBlockDecodedSize < 0) {
    throw new Error('Invalid encoded length');
  }
  const dataSize: number =
    fullBlockCount * fullBlockSize + lastBlockDecodedSize;
  const data: Uint8Array = new Uint8Array(dataSize);
  for (let i = 0; i < fullBlockCount; i += 1) {
    decodeBlock(
      addressArray.subarray(
        i * fullEncodedBlockSize,
        i * fullEncodedBlockSize + fullEncodedBlockSize,
      ),
      data,
      i * fullBlockSize,
    );
  }
  if (lastBlockSize > 0) {
    decodeBlock(
      addressArray.subarray(
        fullBlockCount * fullEncodedBlockSize,
        fullBlockCount * fullEncodedBlockSize + lastBlockSize,
      ),
      data,
      fullBlockCount * fullBlockSize,
    );
  }
  return binToHex(data);
}

export function decodeAddress(address: string) {
  let dec = cnBase58Decode(address);
  const expectedPrefix = encodeVarInt(CRYPTONOTE_PUBLIC_ADDRESS_BASE58_PREFIX);
  const expectedPrefixInt = encodeVarInt(
    CRYPTONOTE_PUBLIC_INTEGRATED_ADDRESS_BASE58_PREFIX,
  );
  const expectedPrefixSub = encodeVarInt(
    CRYPTONOTE_PUBLIC_SUBADDRESS_BASE58_PREFIX,
  );
  const prefix = dec.slice(0, expectedPrefix.length);

  if (
    prefix !== expectedPrefix &&
    prefix !== expectedPrefixInt &&
    prefix !== expectedPrefixSub
  ) {
    throw new Error('Invalid address prefix');
  }

  dec = dec.slice(expectedPrefix.length);
  const spend = dec.slice(0, 64);
  const view = dec.slice(64, 128);

  return {
    spend,
    view,
  };
}

export function serializeTransaction({
  signTxParams,
  encodedTx,
  payload,
}: {
  encodedTx: IEncodedTxDnx;
  signTxParams: ISignTxParams;
  payload: DnxSignature;
}) {
  let rawTx = '';

  const { txKey, computedKeyImages, signatures, outputKeys } = payload;

  const version = '01';
  const unlockTime = '00';
  const inputTypeTag = '02';
  const outputTypeTag = '02';
  const txPubkeyTag = '01';
  const fromAddressTag = '04';
  const toAddressTag = '05';
  const amountTag = '06';
  const txSecTag = '07';
  const extraNonceTag = '02';
  const extraNoncePaymentIdTag = '00';
  const decodedFrom = decodeAddress(encodedTx.from);
  const decodedTo = decodeAddress(encodedTx.to);
  const totalInputAmountBN = signTxParams.inputs.reduce(
    (acc, input) => acc.plus(input.amount),
    new BigNumber(0),
  );
  const chargeAmount = totalInputAmountBN
    .minus(signTxParams.amount)
    .minus(signTxParams.fee);

  rawTx += version;
  rawTx += unlockTime;
  rawTx += encodeVarInt(signTxParams.inputs.length);

  for (let i = 0; i < signTxParams.inputs.length; i += 1) {
    const input = signTxParams.inputs[i];
    rawTx += inputTypeTag;
    rawTx += encodeVarInt(input.amount);
    rawTx += encodeVarInt(1);
    rawTx += encodeVarInt(input.globalIndex);
    rawTx += computedKeyImages[i];
  }

  rawTx += encodeVarInt(outputKeys.length);

  for (let i = 0; i < outputKeys.length; i += 1) {
    const outputKey = outputKeys[i];
    rawTx += encodeVarInt(
      i === outputKeys.length - 1 && chargeAmount.gt(0)
        ? chargeAmount.toNumber()
        : Number(signTxParams.amount),
    );
    rawTx += outputTypeTag;
    rawTx += outputKey;
  }

  let extra = '';

  if (signTxParams.paymentIdHex) {
    extra += extraNonceTag;
    extra += '21';
    extra += extraNoncePaymentIdTag;
    extra += signTxParams.paymentIdHex;
  }

  extra += txPubkeyTag;
  extra += txKey.ephemeralTxPubKey;

  extra += fromAddressTag;
  extra += decodedFrom.spend;
  extra += decodedFrom.view;

  extra += toAddressTag;
  extra += decodedTo.spend;
  extra += decodedTo.view;

  extra += amountTag;
  extra += integerToLittleEndianHex({
    number: Number(signTxParams.amount),
    bytes: 8,
  });

  extra += txSecTag;
  extra += txKey.ephemeralTxSecKey;

  rawTx += encodeVarInt(extra.length / 2);
  rawTx += extra;

  for (const signature of signatures) {
    rawTx += signature;
  }

  return rawTx;
}
