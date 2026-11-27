// onekey: Hermes has no `crypto.subtle`, so the WebCrypto primitives `hpke`
// exports cannot run on React Native. `@panva/hpke-noble` implements the same
// `hpke` KEM/KDF/AEAD interfaces over @noble/*, in pure JS. Same suite as
// `hpkeSuite.ts`: DHKEM(X25519, HKDF-SHA256) / HKDF-SHA256 / AES-128-GCM.
//
// `ohttp-ts` response decryption (`extractPrk`, `expandPrk`, `openWithRawAead`)
// also calls `crypto.subtle` directly instead of `suite.KDF`/`suite.AEAD`.
// `decapsulateOhttpResponse` supplies a scoped pure-JS `crypto.subtle` shim
// (HMAC-SHA256/384/512 + AES-GCM) serialized around the in-memory decryption step.
import { gcm } from '@noble/ciphers/aes';
import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha256';
import { sha384, sha512 } from '@noble/hashes/sha512';
import {
  AEAD_AES_128_GCM,
  KDF_HKDF_SHA256,
  KEM_DHKEM_X25519_HKDF_SHA256,
} from '@panva/hpke-noble';
import { CipherSuite } from 'hpke';

import { StarknetPrivacySdkPlatformError } from './errors';

import type { HttpClientContext } from 'ohttp-ts';

type IHashFn = Parameters<typeof hmac>[0];

const HASH_ALGORITHMS: Record<string, IHashFn> = {
  'SHA-256': sha256,
  'SHA-384': sha384,
  'SHA-512': sha512,
};

type IRawKeyHandle = {
  readonly raw: Uint8Array;
  readonly hash?: IHashFn;
};

function toUint8Array(data: BufferSource): Uint8Array {
  if (data instanceof Uint8Array) {
    return data;
  }
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  return new Uint8Array(data);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

function createNobleOhttpSubtle(): Pick<
  SubtleCrypto,
  'importKey' | 'sign' | 'decrypt'
> {
  return {
    async importKey(
      format: KeyFormat,
      keyData: BufferSource | JsonWebKey,
      algorithm: AlgorithmIdentifier | HmacImportParams,
    ): Promise<CryptoKey> {
      if (
        format !== 'raw' ||
        !(keyData instanceof ArrayBuffer || ArrayBuffer.isView(keyData))
      ) {
        throw new StarknetPrivacySdkPlatformError(
          `Unsupported OHTTP key format: ${format}`,
        );
      }
      const raw = new Uint8Array(toUint8Array(keyData));
      const algName =
        typeof algorithm === 'string' ? algorithm : algorithm.name;
      if (algName === 'HMAC') {
        const hashParam = (algorithm as HmacImportParams).hash;
        const hashName =
          typeof hashParam === 'string' ? hashParam : hashParam.name;
        const hashFn = HASH_ALGORITHMS[hashName];
        if (!hashFn) {
          throw new StarknetPrivacySdkPlatformError(
            `Unsupported OHTTP HMAC hash: ${hashName}`,
          );
        }
        return { raw, hash: hashFn } as unknown as CryptoKey;
      }
      if (algName === 'AES-GCM') {
        return { raw } as unknown as CryptoKey;
      }
      throw new StarknetPrivacySdkPlatformError(
        `Unsupported OHTTP subtle algorithm: ${algName}`,
      );
    },
    async sign(
      algorithm: AlgorithmIdentifier,
      key: CryptoKey,
      data: BufferSource,
    ): Promise<ArrayBuffer> {
      const algName =
        typeof algorithm === 'string' ? algorithm : algorithm.name;
      const handle = key as unknown as IRawKeyHandle;
      if (algName !== 'HMAC' || !handle.hash) {
        throw new StarknetPrivacySdkPlatformError(
          `Unsupported OHTTP sign algorithm: ${algName}`,
        );
      }
      return toArrayBuffer(hmac(handle.hash, handle.raw, toUint8Array(data)));
    },
    async decrypt(
      algorithm: AlgorithmIdentifier | AesGcmParams,
      key: CryptoKey,
      data: BufferSource,
    ): Promise<ArrayBuffer> {
      const algName =
        typeof algorithm === 'string' ? algorithm : algorithm.name;
      if (algName !== 'AES-GCM') {
        throw new StarknetPrivacySdkPlatformError(
          `Unsupported OHTTP decrypt algorithm: ${algName}`,
        );
      }
      const params = algorithm as AesGcmParams;
      const handle = key as unknown as IRawKeyHandle;
      const aad = params.additionalData
        ? toUint8Array(params.additionalData)
        : new Uint8Array(0);
      const plaintext = gcm(handle.raw, toUint8Array(params.iv), aad).decrypt(
        toUint8Array(data),
      );
      return toArrayBuffer(plaintext);
    },
  };
}

const OHTTP_RESPONSE_CONTENT_TYPE = 'message/ohttp-res';

let ohttpDecryptQueue: Promise<unknown> = Promise.resolve();
let isOhttpSubtleShimActive = false;

function hasOhttpSubtleMethods(subtle: unknown): subtle is SubtleCrypto {
  if (!subtle || typeof subtle !== 'object') {
    return false;
  }
  const candidate = subtle as Partial<SubtleCrypto>;
  return (
    typeof candidate.importKey === 'function' &&
    typeof candidate.sign === 'function' &&
    typeof candidate.decrypt === 'function'
  );
}

/** DHKEM(X25519, HKDF-SHA256) / HKDF-SHA256 / AES-128-GCM, via @noble/*. */
export function createPlatformHpkeSuite(): CipherSuite {
  return new CipherSuite(
    KEM_DHKEM_X25519_HKDF_SHA256,
    KDF_HKDF_SHA256,
    AEAD_AES_128_GCM,
  );
}

export async function decapsulateOhttpResponse(
  context: HttpClientContext,
  response: Response,
): Promise<Response> {
  if (
    !isOhttpSubtleShimActive &&
    hasOhttpSubtleMethods(globalThis.crypto?.subtle)
  ) {
    return context.decapsulateResponse(response);
  }
  // Reject non-OHTTP responses before buffering the body, matching ohttp-ts.
  if (response.headers.get('content-type') !== OHTTP_RESPONSE_CONTENT_TYPE) {
    return context.decapsulateResponse(response);
  }
  // Buffer the network body before entering the serialized crypto section so
  // concurrent Discovery calls do not block each other's I/O.
  const bodyBuffer = await response.arrayBuffer();
  const bufferedResponse = {
    headers: response.headers,
    arrayBuffer: () => Promise.resolve(bodyBuffer),
  } as Response;

  const run = async (): Promise<Response> => {
    if (hasOhttpSubtleMethods(globalThis.crypto?.subtle)) {
      return context.decapsulateResponse(bufferedResponse);
    }
    const cryptoObj = globalThis.crypto as unknown as Record<string, unknown>;
    const existingSubtle = globalThis.crypto?.subtle as
      | Record<string, unknown>
      | undefined;
    const previousDescriptor = Object.getOwnPropertyDescriptor(
      cryptoObj,
      'subtle',
    );
    const shimmedSubtle = existingSubtle
      ? Object.assign(
          Object.create(existingSubtle) as Record<string, unknown>,
          createNobleOhttpSubtle(),
        )
      : createNobleOhttpSubtle();
    isOhttpSubtleShimActive = true;
    Object.defineProperty(cryptoObj, 'subtle', {
      value: shimmedSubtle,
      configurable: true,
      writable: true,
    });
    try {
      return await context.decapsulateResponse(bufferedResponse);
    } finally {
      isOhttpSubtleShimActive = false;
      if (previousDescriptor) {
        Object.defineProperty(cryptoObj, 'subtle', previousDescriptor);
      } else {
        delete cryptoObj.subtle;
      }
    }
  };

  const task = ohttpDecryptQueue.then(run, run);
  ohttpDecryptQueue = task.catch(() => undefined);
  return task;
}
