import bs58 from 'bs58';

import { MoneroNetTypeEnum } from './moneroTypes';

import type { MoneroCoreInstance } from './moneroTypes';

const fromHexString = (hexString: string) =>
  new Uint8Array(
    (hexString.match(/.{1,2}/g) || []).map((byte) => parseInt(byte, 16)),
  );
const toHexString = (bytes: Uint8Array) =>
  bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');

class MoneroModule {
  core: MoneroCoreInstance;

  constructor(core: MoneroCoreInstance) {
    this.core = core;
  }

  scReduce32(data: Uint8Array) {
    const dataLen = data.length * data.BYTES_PER_ELEMENT;
    const dataPtr = this.core._malloc(dataLen);
    const dataHeap = new Uint8Array(this.core.HEAPU8.buffer, dataPtr, dataLen);
    dataHeap.set(data);
    this.core.ccall('sc_reduce32', null, ['number'], [dataHeap.byteOffset]);
    const res = new Uint8Array(dataHeap);
    this.core._free(dataHeap.byteOffset);
    return res;
  }

  secretKeyToPublicKey(data: Uint8Array) {
    const outLen = data.length * data.BYTES_PER_ELEMENT;
    const outPtr = this.core._malloc(outLen);
    const outHeap = new Uint8Array(this.core.HEAPU8.buffer, outPtr, outLen);
    const ok = this.core.ccall(
      'secret_key_to_public_key',
      'boolean',
      ['array', 'number'],
      [data, outHeap.byteOffset],
    );
    let res = null;
    if (ok) res = new Uint8Array(outHeap);
    this.core._free(outHeap.byteOffset);
    return res;
  }

  cnFastHash(data: Uint8Array) {
    const outLen = 32;
    const outPtr = this.core._malloc(outLen);
    const outHeap = new Uint8Array(this.core.HEAPU8.buffer, outPtr, outLen);
    this.core.ccall(
      'cn_fast_hash',
      null,
      ['array', 'number', 'number'],
      [data, data.length * data.BYTES_PER_ELEMENT, outHeap.byteOffset],
    );
    const res = new Uint8Array(outHeap);
    this.core._free(outHeap.byteOffset);
    return res;
  }

  hashToScalar(data: Uint8Array) {
    return this.scReduce32(this.cnFastHash(data));
  }

  getSubaddressSecretKey(data: Uint8Array, major: number, minor: number) {
    const outLen = 32;
    const outPtr = this.core._malloc(outLen);
    const outHeap = new Uint8Array(this.core.HEAPU8.buffer, outPtr, outLen);
    this.core.ccall(
      'get_subaddress_secret_key',
      null,
      ['array', 'number', 'number', 'number'],
      [data, major, minor, outHeap.byteOffset],
    );
    const res = new Uint8Array(outHeap);
    this.core._free(outHeap.byteOffset);
    return res;
  }

  scAdd(x: Uint8Array, y: Uint8Array) {
    const outLen = 32;
    const outPtr = this.core._malloc(outLen);
    const outHeap = new Uint8Array(this.core.HEAPU8.buffer, outPtr, outLen);
    this.core.ccall(
      'sc_add',
      null,
      ['number', 'array', 'array'],
      [outHeap.byteOffset, x, y],
    );
    const res = new Uint8Array(outHeap);
    this.core._free(outHeap.byteOffset);
    return res;
  }

  scalarmultKey(x: Uint8Array, y: Uint8Array) {
    const outLen = 32;
    const outPtr = this.core._malloc(outLen);
    const outHeap = new Uint8Array(this.core.HEAPU8.buffer, outPtr, outLen);
    const ok = this.core.ccall(
      'scalarmultKey',
      'boolean',
      ['number', 'array', 'array'],
      [outHeap.byteOffset, x, y],
    );
    let res = null;
    if (ok) res = new Uint8Array(outHeap);
    this.core._free(outHeap.byteOffset);
    return res;
  }

  pubKeysToAddress(
    net: MoneroNetTypeEnum,
    isSubaddress: boolean,
    publicSpendKey: Uint8Array,
    publicViewKey: Uint8Array,
  ) {
    let prefix = '';
    if (net === MoneroNetTypeEnum.MainNet) {
      prefix = '12';
      if (isSubaddress) prefix = '2A';
    } else if (net === MoneroNetTypeEnum.TestNet) {
      prefix = '35';
      if (isSubaddress) prefix = '3F';
    } else if (net === MoneroNetTypeEnum.StageNet) {
      prefix = '18';
      if (isSubaddress) prefix = '24';
    }
    let resHex = `${prefix}${toHexString(publicSpendKey)}${toHexString(
      publicViewKey,
    )}`;
    const checksum = this.cnFastHash(fromHexString(resHex));
    resHex += toHexString(checksum).substring(0, 8);
    return bs58.encode(fromHexString(resHex));
  }
}

export { MoneroModule };
