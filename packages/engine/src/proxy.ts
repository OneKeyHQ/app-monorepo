/* eslint no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */
/* eslint @typescript-eslint/no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */
/* eslint max-classes-per-file: "off" */

import { Buffer } from 'buffer';

import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';

import type { ICurveName } from '@onekeyhq/core/src/secret';
import {
  N,
  sign,
  uncompressPublicKey,
  verify,
} from '@onekeyhq/core/src/secret';
import { decrypt } from '@onekeyhq/core/src/secret/encryptors/aes256';
import type { ChainInfo } from '@onekeyhq/engine/src/types/chain';
import type {
  Signer as ISigner,
  Verifier as IVerifier,
} from '@onekeyhq/engine/src/types/secret';
import {
  IMPL_ALGO,
  IMPL_BCH,
  IMPL_BTC,
  IMPL_DOGE,
  IMPL_LTC,
  IMPL_TBTC,
  SEPERATOR,
} from '@onekeyhq/shared/src/engine/engineConsts';
import bufferUitls from '@onekeyhq/shared/src/utils/bufferUtils';

import { getCurveByImpl } from './managers/impl';
import { getPresetNetworks } from './presets';
import { IMPL_MAPPINGS, fillUnsignedTx, fillUnsignedTxObj } from './proxyUtils';

import type { DBNetwork } from './types/network';

function fromDBNetworkToChainInfo(dbNetwork: DBNetwork): ChainInfo {
  const defaultClient = IMPL_MAPPINGS[dbNetwork.impl]?.defaultClient;

  let providerOptions: Record<string, any> = {};
  let { rpcURL } = dbNetwork;
  let algoIndexerURL = '';

  const presetNetwork = getPresetNetworks()[dbNetwork.id];
  if (typeof presetNetwork !== 'undefined') {
    ({ providerOptions } = presetNetwork.extensions || { providerOptions: {} });
    rpcURL = rpcURL || presetNetwork.presetRpcURLs[0];
    if (presetNetwork.impl === IMPL_ALGO) {
      const urlGroup = (presetNetwork.rpcURLs || [])[0];
      algoIndexerURL = (urlGroup || {}).indexer ?? '';
    }
  }

  let implOptions = providerOptions || {};

  const chainId = parseInt(dbNetwork.id.split(SEPERATOR)[1]);
  implOptions = { ...implOptions, chainId };

  let code = dbNetwork.id;
  if (
    [IMPL_BTC, IMPL_DOGE, IMPL_LTC, IMPL_BCH, IMPL_TBTC].includes(
      dbNetwork.impl,
    )
  ) {
    code = dbNetwork.impl;
  }

  return {
    code,
    feeCode: dbNetwork.id,
    impl: dbNetwork.impl,
    curve: (dbNetwork.curve || getCurveByImpl(dbNetwork.impl)) as ICurveName,
    implOptions,
    clients: [
      {
        name: defaultClient,
        args:
          dbNetwork.impl === IMPL_ALGO
            ? [rpcURL, { url: algoIndexerURL }]
            : [rpcURL],
      },
    ],
  };
}

export { fillUnsignedTx, fillUnsignedTxObj };

export interface IVerifierPro extends IVerifier {
  verifySignature(params: {
    publicKey: Buffer | Uint8Array | string; // hex string or Buffer
    digest: Buffer | Uint8Array | string; // hex string or Buffer
    signature: Buffer | Uint8Array | string; // hex string or Buffer
  }): Promise<boolean>;
}

// TODO move to core
export class Verifier implements IVerifierPro {
  private uncompressedPublicKey: Buffer;

  private compressedPublicKey: Buffer;

  curve: ICurveName;

  constructor(pub: string, curve: ICurveName) {
    this.curve = curve;
    this.compressedPublicKey = Buffer.from(pub, 'hex');
    this.uncompressedPublicKey = uncompressPublicKey(
      curve,
      this.compressedPublicKey,
    );
  }

  getPubkey(compressed?: boolean) {
    return Promise.resolve(
      compressed ? this.compressedPublicKey : this.uncompressedPublicKey,
    );
  }

  verify(_digest: Buffer, _signature: Buffer) {
    // Not used.
    return Promise.resolve(Buffer.from([]));
  }

  verifySignature({
    publicKey,
    digest,
    signature,
  }: {
    publicKey: Buffer | Uint8Array | string; // hex string or Buffer
    digest: Buffer | Uint8Array | string; // hex string or Buffer
    signature: Buffer | Uint8Array | string; // hex string or Buffer
  }): Promise<boolean> {
    const p = bufferUitls.toBuffer(publicKey);
    const d = bufferUitls.toBuffer(digest);
    const s = bufferUitls.toBuffer(signature);
    const { curve } = this;
    const result = verify(curve, p, d, s);
    return Promise.resolve(result);
  }
}

// TODO move to core
// @ts-ignore
export class ChainSigner extends Verifier implements ISigner {
  constructor(
    private encryptedPrivateKey: Buffer,
    private password: string,
    private override curve: ICurveName,
  ) {
    super(
      N(
        curve,
        { key: encryptedPrivateKey, chainCode: Buffer.alloc(32) },
        password,
      ).key.toString('hex'),
      curve,
    );
  }

  getPrvkey(): Promise<Buffer> {
    return Promise.resolve(decrypt(this.password, this.encryptedPrivateKey));
  }

  sign(digest: Buffer): Promise<[Buffer, number]> {
    const signature = sign(
      this.curve,
      this.encryptedPrivateKey,
      digest,
      this.password,
    );
    if (this.curve === 'secp256k1') {
      return Promise.resolve([
        signature.slice(0, -1),
        signature[signature.length - 1],
      ]);
    }
    return Promise.resolve([signature, 0]);
  }
}

// blockchain-libs can throw ResponseError and JSONResponseError upon rpc call
// errors/failures. Each error has both message & response properties.
// We read the possible error, categorize it by its message and decide
// what to throw to upper layer.
function extractResponseError(e: unknown): unknown {
  const { message, response } = e as { message?: string; response?: any };
  if (typeof message === 'undefined' || typeof response === 'undefined') {
    // not what we expected, throw original error out.
    return e;
  }
  if (message === 'Error JSON PRC response') {
    // TODO: avoid this stupid string comparison and there is even an unbearable typo.
    // this is what blockchain-libs can throw upon a JSON RPC call failure
    const { error: rpcError } = response;
    if (typeof rpcError !== 'undefined') {
      return web3Errors.rpc.internal({ data: rpcError });
    }
  }
  // Otherwise, throw the original error out.
  // TODO: see whether to wrap it into a gerinic OneKeyError.
  return e;
}

export { extractResponseError, fromDBNetworkToChainInfo };
