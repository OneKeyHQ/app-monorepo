/* eslint-disable camelcase */
import MyMoneroLibAppBridgeClass from '@mymonero/mymonero-app-bridge/MyMoneroLibAppBridgeClass';
import {
  Lazy_KeyImage,
  Lazy_KeyImageCacheForWalletWith,
} from '@mymonero/mymonero-keyimage-cache';
import axios from 'axios';

import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import { cnFastHash } from './moneroAddress';

import type { MoneroCoreInstance } from './moneroCore/moneroCoreTypes';
import type { MoneroUtilInstance } from './moneroUtil/moneroUtilTypes';
import type { ISignedTxPro } from '../../../types';
import type { ISendFundsArgs, ISendFundsCallback } from '../types';

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

class Helper {
  utilModule: MoneroUtilInstance;

  coreModule: MoneroCoreInstance;

  constructor(utilModule: MoneroUtilInstance, coreModule: MoneroCoreInstance) {
    this.utilModule = utilModule;
    this.coreModule = coreModule;
  }

  scReduce32(data: Uint8Array) {
    const dataLen = data.length * data.BYTES_PER_ELEMENT;
    const dataPtr = this.utilModule._malloc(dataLen);
    const dataHeap = new Uint8Array(
      this.utilModule.HEAPU8.buffer,
      dataPtr,
      dataLen,
    );
    dataHeap.set(data);
    this.utilModule.ccall(
      'sc_reduce32',
      null,
      ['number'],
      [dataHeap.byteOffset],
    );
    const res = new Uint8Array(dataHeap);
    this.utilModule._free(dataHeap.byteOffset);
    return res;
  }

  scAdd(x: Uint8Array, y: Uint8Array) {
    const outLen = 32;
    const outPtr = this.utilModule._malloc(outLen);
    const outHeap = new Uint8Array(
      this.utilModule.HEAPU8.buffer,
      outPtr,
      outLen,
    );
    this.utilModule.ccall(
      'sc_add',
      null,
      ['number', 'array', 'array'],
      [outHeap.byteOffset, x, y],
    );
    const res = new Uint8Array(outHeap);
    this.utilModule._free(outHeap.byteOffset);
    return res;
  }

  privateKeyToPublicKey(data: Uint8Array) {
    const outLen = data.length * data.BYTES_PER_ELEMENT;
    const outPtr = this.utilModule._malloc(outLen);
    const outHeap = new Uint8Array(
      this.utilModule.HEAPU8.buffer,
      outPtr,
      outLen,
    );
    const ok = this.utilModule.ccall(
      'secret_key_to_public_key',
      'boolean',
      ['array', 'number'],
      [data, outHeap.byteOffset],
    );
    let res = null;
    if (ok) res = new Uint8Array(outHeap);
    this.utilModule._free(outHeap.byteOffset);
    return res;
  }

  hashToScalar(data: Uint8Array) {
    return this.scReduce32(cnFastHash(data));
  }

  getSubaddressPrivateKey(data: Uint8Array, major: number, minor: number) {
    const outLen = 32;
    const outPtr = this.utilModule._malloc(outLen);
    const outHeap = new Uint8Array(
      this.utilModule.HEAPU8.buffer,
      outPtr,
      outLen,
    );
    this.utilModule.ccall(
      'get_subaddress_secret_key',
      null,
      ['array', 'number', 'number', 'number'],
      [data, major, minor, outHeap.byteOffset],
    );
    const res = new Uint8Array(outHeap);
    this.utilModule._free(outHeap.byteOffset);
    return res;
  }

  scalarmultKey(x: Uint8Array, y: Uint8Array) {
    const outLen = 32;
    const outPtr = this.utilModule._malloc(outLen);
    const outHeap = new Uint8Array(
      this.utilModule.HEAPU8.buffer,
      outPtr,
      outLen,
    );
    const ok = this.utilModule.ccall(
      'scalarmultKey',
      'boolean',
      ['number', 'array', 'array'],
      [outHeap.byteOffset, x, y],
    );
    let res = null;
    if (ok) res = new Uint8Array(outHeap);
    this.utilModule._free(outHeap.byteOffset);
    return res;
  }

  getKeyPairFromRawPrivatekey({
    rawPrivateKey,
    isPrivateSpendKey,
    index = 0,
  }: {
    rawPrivateKey: string;
    isPrivateSpendKey?: boolean;
    index?: number;
  }): {
    privateSpendKey: string;
    privateViewKey: string;
    publicSpendKey: string | null;
    publicViewKey: string | null;
  } {
    const raw = Buffer.from(rawPrivateKey, 'hex');

    let privateSpendKey;

    if (isPrivateSpendKey) {
      privateSpendKey = raw;
    } else {
      privateSpendKey = this.scReduce32(raw);
    }

    const privateViewKey = this.hashToScalar(privateSpendKey);
    let publicSpendKey: Uint8Array | null;
    let publicViewKey: Uint8Array | null;

    if (index === 0) {
      publicSpendKey = this.privateKeyToPublicKey(privateSpendKey);
      publicViewKey = this.privateKeyToPublicKey(privateViewKey);
    } else {
      const m = this.getSubaddressPrivateKey(privateViewKey, index, 0);
      privateSpendKey = this.scAdd(m, privateSpendKey);
      publicSpendKey = this.privateKeyToPublicKey(privateSpendKey);
      publicViewKey = this.scalarmultKey(
        publicSpendKey || new Uint8Array(),
        privateViewKey,
      );
    }

    return {
      privateSpendKey: bufferUtils.bytesToHex(privateSpendKey),
      privateViewKey: bufferUtils.bytesToHex(privateViewKey),
      publicSpendKey: publicSpendKey
        ? bufferUtils.bytesToHex(publicSpendKey)
        : null,
      publicViewKey: publicViewKey
        ? bufferUtils.bytesToHex(publicViewKey)
        : null,
    };
  }

  generateKeyImage(params: {
    txPublicKey: string;
    privateViewKey: string;
    privateSpendKey: string;
    publicSpendKey: string;
    outputIndex: string;
    address: string;
  }) {
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
      this.coreModule,
    );

    return handleMoneroCoreResponse<string>(keyImageJsonStr);
  }

  decodeAddress({ address, netType }: { address: string; netType: string }) {
    const result = this.coreModule.decode_address(address, netType);
    const decodedAddress = JSON.parse(result);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return decodedAddress;
  }

  estimatedTxFee({
    priority,
    feePerByte,
  }: {
    priority: string;
    feePerByte: string;
  }) {
    const feeStr = this.coreModule.estimated_tx_network_fee(
      priority,
      feePerByte,
      '0',
    );

    const fee = handleMoneroCoreResponse<string>(feeStr);

    return fee;
  }

  async sendFunds(args: any, scanUrl: string): Promise<ISignedTxPro> {
    const instance = axios.create({
      baseURL: scanUrl,
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
            // TODO signOnly support, skip submit return {status: "OK"}
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
            txKey: params.tx_key,
            encodedTx: null,
          });
        },
        error_fn: (params) => {
          reject(params.err_msg ?? params.err_code);
        },
      };

      const lib = new MyMoneroLibAppBridgeClass(this.coreModule);
      lib.async__send_funds(sendFundsArgs);
    });
  }

  seedAndkeysFromMnemonic({
    mnemonic,
    netType,
  }: {
    mnemonic: string;
    netType: string;
  }) {
    const resp = this.coreModule.seed_and_keys_from_mnemonic(mnemonic, netType);
    const result = JSON.parse(resp) as {
      err_msg?: string;
      seed: string;
      address: string;
      publicViewKey: string;
      publicSpendKey: string;
      privateViewKey: string;
      privateSpendKey: string;
    };
    return result;
  }
}

export { Helper };
