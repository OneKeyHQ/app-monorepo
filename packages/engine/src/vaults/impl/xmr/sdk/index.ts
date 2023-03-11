/* eslint-disable camelcase */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-bitwise */
import MyMoneroLibAppBridgeClass from '@mymonero/mymonero-app-bridge/MyMoneroLibAppBridgeClass';
import {
  Lazy_KeyImage,
  Lazy_KeyImageCacheForWalletWith,
} from '@mymonero/mymonero-keyimage-cache';
import axios from 'axios';
import sha3 from 'js-sha3';

import { OneKeyInternalError } from '../../../../errors';

import * as moneroAddress from './moneroAddress';
import { getMoneroCoreInstance } from './moneroCore/instance';
import { getMoneroUtilInstance } from './moneroUtil/instance';
import { privateSpendKeyToWords } from './moneroWords';

import type { SignedTx } from '../../../../types/provider';
import type { ISendFundsArgs, ISendFundsCallback } from '../types';

const walletUrl = 'https://node.onekey.so/mymonero';

const handleMoneroCoreResponse = <T>(
  resp: undefined | string | { retVal: T },
) => {
  if (resp !== undefined) {
    if (typeof resp === 'string') {
      try {
        const result: { retVal: T } = JSON.parse(resp);

        if (result.retVal !== undefined) return result.retVal;

        return resp;
      } catch {
        return resp;
      }
    }

    return resp.retVal;
  }
  return resp;
};

const getMoneroApi = async () => {
  const moneroCoreInstance = await getMoneroCoreInstance();
  const moneroUtilInstance = await getMoneroUtilInstance();

  console.log(moneroCoreInstance);

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

  const hashToScalar = (data: Uint8Array) =>
    scReduce32(moneroAddress.cnFastHash(data));

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

    return Promise.resolve(handleMoneroCoreResponse<string>(keyImageJsonStr));
  };

  const decodeAddress = async (address: string, netType: string) => {
    const result = moneroCoreInstance.decode_address(address, netType);
    return Promise.resolve(JSON.parse(result));
  };

  const estimatedTxFee = async (priority: string, feePerByte: string) => {
    const fee = moneroCoreInstance.estimated_tx_network_fee(
      priority,
      feePerByte,
      '0',
    );
    return Promise.resolve(handleMoneroCoreResponse<string>(fee));
  };

  const sendFunds = async (args: any): Promise<SignedTx> => {
    const instance = axios.create({
      baseURL: walletUrl,
    });
    return new Promise((resolve, reject) => {
      const sendFundsArgs: ISendFundsArgs & ISendFundsCallback = {
        ...args,
        willBeginSending_fn: () => {},
        authenticate_fn: () => {},
        status_update_fn: () => {},
        canceled_fn: () => {
          reject(new OneKeyInternalError('Transaction canceled'));
        },
        get_unspent_outs_fn: async (params, callback) => {
          try {
            const resp = await instance.post('/get_unspent_outs', params);
            callback(null, resp.data);
          } catch {
            reject(new OneKeyInternalError('Get unspent outs error.'));
          }
        },
        get_random_outs_fn: async (params, callback) => {
          try {
            const resp = await instance.post('/get_random_outs', params);
            callback(null, resp.data);
          } catch {
            reject(new OneKeyInternalError('Get unspent outs error.'));
          }
        },
        submit_raw_tx_fn: async (params, callback) => {
          try {
            const resp = await instance.post('/submit_raw_tx', params);
            callback(null, resp.data);
          } catch {
            reject(new OneKeyInternalError('Submit raw tx error.'));
          }
        },
        success_fn: (params) => {
          resolve({
            txid: params.tx_hash,
            rawTx: params.serialized_signed_tx,
          });
        },
        error_fn: (params) => {
          reject(params.err_msg ?? params.err_code);
        },
      };

      const lib = new MyMoneroLibAppBridgeClass(moneroCoreInstance);
      lib.async__send_funds(sendFundsArgs);
    });
  };

  return {
    getKeyPairFromRawPrivatekey,
    privateSpendKeyToWords,
    pubKeysToAddress: moneroAddress.pubKeysToAddress,
    generateKeyImage,
    decodeAddress,
    estimatedTxFee,
    sendFunds,
  };
};

/**
 * Web SDK is always successful
 */
const ensureSDKReady = async () => Promise.resolve(true);

export { getMoneroApi, ensureSDKReady };
