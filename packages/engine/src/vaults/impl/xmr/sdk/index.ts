/* eslint-disable camelcase */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-bitwise */
import {
  Lazy_KeyImage,
  Lazy_KeyImageCacheForWalletWith,
} from '@mymonero/mymonero-keyimage-cache';
import sha3 from 'js-sha3';

import { cnFastHash, pubKeysToAddress } from './moneroAddress';
import { getMoneroCoreInstance } from './moneroCore/instance';
import { getMoneroUtilInstance } from './moneroUtil/instance';
import { privateSpendKeyToWords } from './moneroWords';

const getMoneroApi = async () => {
  const moneroCoreInstance = await getMoneroCoreInstance();
  const moneroUtilInstance = await getMoneroUtilInstance();

  const scReduce32 = (data: Uint8Array) => {
    const dataLen = data.length * data.BYTES_PER_ELEMENT;
    const dataPtr = moneroUtilInstance._malloc(dataLen);
    const dataHeap = new Uint8Array(
      moneroUtilInstance.HEAPU8.buffer,
      dataPtr,
      dataLen,
    );
    dataHeap.set(data);
    moneroUtilInstance.ccall(
      'sc_reduce32',
      null,
      ['number'],
      [dataHeap.byteOffset],
    );
    const res = new Uint8Array(dataHeap);
    moneroUtilInstance._free(dataHeap.byteOffset);
    return res;
  };

  const scAdd = (x: Uint8Array, y: Uint8Array) => {
    const outLen = 32;
    const outPtr = moneroUtilInstance._malloc(outLen);
    const outHeap = new Uint8Array(
      moneroUtilInstance.HEAPU8.buffer,
      outPtr,
      outLen,
    );
    moneroUtilInstance.ccall(
      'sc_add',
      null,
      ['number', 'array', 'array'],
      [outHeap.byteOffset, x, y],
    );
    const res = new Uint8Array(outHeap);
    moneroUtilInstance._free(outHeap.byteOffset);
    return res;
  };

  const privateKeyToPublicKey = (data: Uint8Array) => {
    const outLen = data.length * data.BYTES_PER_ELEMENT;
    const outPtr = moneroUtilInstance._malloc(outLen);
    const outHeap = new Uint8Array(
      moneroUtilInstance.HEAPU8.buffer,
      outPtr,
      outLen,
    );
    const ok = moneroUtilInstance.ccall(
      'secret_key_to_public_key',
      'boolean',
      ['array', 'number'],
      [data, outHeap.byteOffset],
    );
    let res = null;
    if (ok) res = new Uint8Array(outHeap);
    moneroUtilInstance._free(outHeap.byteOffset);
    return res;
  };

  const hashToScalar = (data: Uint8Array) => scReduce32(cnFastHash(data));

  const getSubaddressPrivateKey = (
    data: Uint8Array,
    major: number,
    minor: number,
  ) => {
    const outLen = 32;
    const outPtr = moneroUtilInstance._malloc(outLen);
    const outHeap = new Uint8Array(
      moneroUtilInstance.HEAPU8.buffer,
      outPtr,
      outLen,
    );
    moneroUtilInstance.ccall(
      'get_subaddress_secret_key',
      null,
      ['array', 'number', 'number', 'number'],
      [data, major, minor, outHeap.byteOffset],
    );
    const res = new Uint8Array(outHeap);
    moneroUtilInstance._free(outHeap.byteOffset);
    return res;
  };

  const scalarmultKey = (x: Uint8Array, y: Uint8Array) => {
    const outLen = 32;
    const outPtr = moneroUtilInstance._malloc(outLen);
    const outHeap = new Uint8Array(
      moneroUtilInstance.HEAPU8.buffer,
      outPtr,
      outLen,
    );
    const ok = moneroUtilInstance.ccall(
      'scalarmultKey',
      'boolean',
      ['number', 'array', 'array'],
      [outHeap.byteOffset, x, y],
    );
    let res = null;
    if (ok) res = new Uint8Array(outHeap);
    moneroUtilInstance._free(outHeap.byteOffset);
    return res;
  };

  const getKeyPairFromRawPrivatekey = async ({
    rawPrivateKey,
    index = 0,
  }: {
    rawPrivateKey: Buffer;
    index?: number;
  }) => {
    const rawSecretSpendKey = new Uint8Array(
      sha3.keccak_256.update(rawPrivateKey).arrayBuffer(),
    );
    let privateSpendKey = scReduce32(rawSecretSpendKey);
    const privateViewKey = hashToScalar(privateSpendKey);

    let publicSpendKey: Uint8Array | null;
    let publicViewKey: Uint8Array | null;

    if (index === 0) {
      publicSpendKey = privateKeyToPublicKey(privateSpendKey);
      publicViewKey = privateKeyToPublicKey(privateViewKey);
    } else {
      const m = getSubaddressPrivateKey(privateViewKey, index, 0);
      privateSpendKey = scAdd(m, privateSpendKey);
      publicSpendKey = privateKeyToPublicKey(privateSpendKey);
      publicViewKey = scalarmultKey(
        publicSpendKey || new Uint8Array(),
        privateViewKey,
      );
    }

    return Promise.resolve({
      privateSpendKey,
      privateViewKey,
      publicSpendKey,
      publicViewKey,
    });
  };

  const generateKeyImage = async (params: {
    txPublicKey: string;
    privateViewKey: string;
    privateSpendKey: string;
    publicSpendKey: string;
    outputIndex: string;
    address: string;
  }) => {
    const {
      txPublicKey,
      privateSpendKey,
      privateViewKey,
      publicSpendKey,
      outputIndex,
      address,
    } = params;

    const keyImageCache = Lazy_KeyImageCacheForWalletWith(address);

    const keyImageJsonStr = Lazy_KeyImage(
      keyImageCache,
      txPublicKey,
      outputIndex,
      address,
      privateViewKey,
      publicSpendKey,
      privateSpendKey,
      moneroCoreInstance,
    );

    if (typeof keyImageJsonStr === 'string') {
      try {
        const keyImageObj = JSON.parse(keyImageJsonStr) as { retVal: string };

        if (keyImageObj.retVal)
          return await Promise.resolve(keyImageObj.retVal);
      } catch {
        // pass
      }
    }
  };

  return {
    getKeyPairFromRawPrivatekey,
    privateSpendKeyToWords,
    pubKeysToAddress,
    generateKeyImage,
  };
};

/**
 * Web SDK is always successful
 */
const ensureSDKReady = async () => Promise.resolve(true);

export { getMoneroApi, ensureSDKReady };
