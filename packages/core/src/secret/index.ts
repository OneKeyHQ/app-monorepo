import { clearPbkdf2Cache } from '@onekeyhq/shared/src/appCrypto/modules/pbkdf2';
import type {
  IPbkdf2DispatchBackend,
  IPbkdf2KdfParams,
} from '@onekeyhq/shared/src/appCrypto/modules/pbkdf2';
import appGlobals from '@onekeyhq/shared/src/appGlobals';
import { DEFAULT_VERIFY_STRING } from '@onekeyhq/shared/src/consts/dbConsts';
import { InvalidMnemonic, OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import { BaseBip32KeyDeriver, ED25519Bip32KeyDeriver } from './bip32';
import {
  mnemonicToRevealableSeed,
  mnemonicToSeed,
  revealEntropyToMnemonic,
  revealEntropyToRawEntropy,
  validateMnemonic,
} from './bip39';
import { ed25519, nistp256, secp256k1 } from './curves';
import {
  ESecretEncryptPayloadFormat,
  decryptAsync,
  decryptAsyncWithMetadata,
  encryptAsync,
  encryptStringAsync,
  ensureSensitiveTextEncoded,
  getSecretEncryptV2LocalTargetIterations,
} from './encryptors/aes256';
import { hash160, hash160Sync } from './hash';
import ecc from './nobleSecp256k1Wrapper';
import {
  tonMnemonicToRevealableSeed,
  tonRevealEntropyToMnemonic,
} from './ton-mnemonic';

import type {
  IBip32ExtendedKey,
  IBip32ExtendedKeySerialized,
  IBip32KeyDeriver,
  IBip32PerfTrace,
  IBip32PerfTraceEvent,
} from './bip32';
import type {
  IBip39RevealableSeed,
  IBip39RevealableSeedEncryptHex,
  IMnemonicToSeedKdfBackend,
  IMnemonicToSeedPerfTrace,
} from './bip39';
import type { BaseCurve } from './curves';
import type {
  ICoreHdCredentialEncryptHex,
  ICoreHyperLiquidAgentCredential,
  ICoreHyperLiquidAgentCredentialEncryptHex,
  ICoreImportedCredential,
  ICoreImportedCredentialEncryptHex,
  ICurveName,
} from '../types';

export * from './bip32';
export * from './bip340';
export * from './bip39';
export * from './botWallet';
export * from './curves';
export * from './encryptors/aes256';

export * from '@onekeyhq/shared/src/appCrypto/modules/hash';
export * from './ton-mnemonic';
export { ecc };

const EncryptPrefixImportedCredential = '|PK|'; // private key
const EncryptPrefixHdCredential = '|RP|'; // recovery phrase
const EncryptPrefixVerifyString = '|VS|'; // verify string
const EncryptPrefixHyperLiquidAgentCredential = '|HL|'; // legacy encrypted
const EncryptPrefixHyperLiquidAgentCredentialPlain = '|HLP|'; // plaintext (new)

const curves: Map<ICurveName, BaseCurve> = new Map([
  ['secp256k1', secp256k1],
  ['nistp256', nistp256],
  ['ed25519', ed25519],
]);
const derivers: Map<ICurveName, IBip32KeyDeriver> = new Map([
  [
    'secp256k1',
    new BaseBip32KeyDeriver(
      Buffer.from('Bitcoin seed'),
      secp256k1,
    ) as IBip32KeyDeriver,
  ],
  [
    'nistp256',
    new BaseBip32KeyDeriver(
      Buffer.from('Nist256p1 seed'),
      nistp256,
    ) as IBip32KeyDeriver,
  ],
  [
    'ed25519',
    new ED25519Bip32KeyDeriver(
      Buffer.from('ed25519 seed'),
      ed25519,
    ) as IBip32KeyDeriver,
  ],
]);

type ISecretKdfParams = IPbkdf2KdfParams & {
  kdfBackend?: IPbkdf2DispatchBackend;
  enablePbkdf2Cache?: boolean;
  debugCryptoProbeId?: string;
};

export type IHdCredentialDecryptCacheParams = {
  hdCredentialCacheScopeId?: string;
} & ISecretKdfParams;

export type IClearHdCredentialDecryptCacheParams = {
  hdCredentialCacheScopeId: string;
};

const HD_CREDENTIAL_DECRYPT_CACHE_TTL_MS = 60 * 1000;
const HD_CREDENTIAL_DECRYPT_CACHE_MAX_ENTRIES = 128;

type IHdCredentialDecryptCacheBuffers = {
  entropyWithLangPrefixedBuffer: Buffer;
  seedBuffer: Buffer;
};

type IHdCredentialDecryptCacheEntry = {
  hdCredentialCacheScopeId: string;
  expiresAt: number;
  buffersPromise?: Promise<IHdCredentialDecryptCacheBuffers>;
  entropyWithLangPrefixedBuffer?: Buffer;
  seedBuffer?: Buffer;
  timeout?: ReturnType<typeof setTimeout>;
};

const hdCredentialDecryptCache = new Map<
  string,
  IHdCredentialDecryptCacheEntry
>();
const hdCredentialDecryptCacheScopeKeys = new Map<string, Set<string>>();

export type IBatchGetPublicKeysPerfTraceEvent = {
  source: 'batchGetKeys' | 'bip32';
  name: string;
  durationMs: number;
  metadata?: IBip32PerfTraceEvent['metadata'];
};

export type IBatchGetPublicKeysPerfTrace = {
  onEvent: (event: IBatchGetPublicKeysPerfTraceEvent) => void;
};

function perfTraceNowMs(): number {
  return performance.now();
}

function traceBatchGetPublicKeys<T>({
  perfTrace,
  name,
  metadata,
  fn,
}: {
  perfTrace: IBatchGetPublicKeysPerfTrace | undefined;
  name: string;
  metadata?: IBatchGetPublicKeysPerfTraceEvent['metadata'];
  fn: () => T;
}): T {
  if (!perfTrace) {
    return fn();
  }
  const start = perfTraceNowMs();
  try {
    return fn();
  } finally {
    perfTrace.onEvent({
      source: 'batchGetKeys',
      name,
      durationMs: perfTraceNowMs() - start,
      metadata,
    });
  }
}

async function traceBatchGetPublicKeysAsync<T>({
  perfTrace,
  name,
  metadata,
  fn,
}: {
  perfTrace: IBatchGetPublicKeysPerfTrace | undefined;
  name: string;
  metadata?: IBatchGetPublicKeysPerfTraceEvent['metadata'];
  fn: () => Promise<T>;
}): Promise<T> {
  if (!perfTrace) {
    return fn();
  }
  const start = perfTraceNowMs();
  try {
    return await fn();
  } finally {
    perfTrace.onEvent({
      source: 'batchGetKeys',
      name,
      durationMs: perfTraceNowMs() - start,
      metadata,
    });
  }
}

function createBip32PerfTrace(
  perfTrace: IBatchGetPublicKeysPerfTrace | undefined,
): IBip32PerfTrace | undefined {
  if (!perfTrace) {
    return undefined;
  }
  return {
    onEvent: (event) => {
      perfTrace.onEvent({
        source: 'bip32',
        ...event,
      });
    },
  };
}

function zeroBuffer(buffer?: Buffer) {
  buffer?.fill(0);
}

function zeroHdCredentialCacheBuffers(
  buffers?: Partial<IHdCredentialDecryptCacheBuffers>,
) {
  zeroBuffer(buffers?.entropyWithLangPrefixedBuffer);
  zeroBuffer(buffers?.seedBuffer);
}

function cloneHdCredentialCacheBuffers(
  buffers: IHdCredentialDecryptCacheBuffers,
): IHdCredentialDecryptCacheBuffers {
  return {
    entropyWithLangPrefixedBuffer: Buffer.from(
      buffers.entropyWithLangPrefixedBuffer,
    ),
    seedBuffer: Buffer.from(buffers.seedBuffer),
  };
}

function revealableSeedToCacheBuffers(
  revealableSeed: IBip39RevealableSeed,
): IHdCredentialDecryptCacheBuffers {
  return {
    entropyWithLangPrefixedBuffer: bufferUtils.toBuffer(
      revealableSeed.entropyWithLangPrefixed,
      'hex',
    ),
    seedBuffer: bufferUtils.toBuffer(revealableSeed.seed, 'hex'),
  };
}

function deleteHdCredentialDecryptCacheEntry(cacheKey: string) {
  const entry = hdCredentialDecryptCache.get(cacheKey);
  if (!entry) {
    return;
  }
  if (entry.timeout) {
    clearTimeout(entry.timeout);
  }
  zeroHdCredentialCacheBuffers(entry);
  entry.entropyWithLangPrefixedBuffer = undefined;
  entry.seedBuffer = undefined;
  entry.buffersPromise = undefined;
  hdCredentialDecryptCache.delete(cacheKey);

  const scopeKeys = hdCredentialDecryptCacheScopeKeys.get(
    entry.hdCredentialCacheScopeId,
  );
  scopeKeys?.delete(cacheKey);
  if (scopeKeys && scopeKeys.size <= 0) {
    hdCredentialDecryptCacheScopeKeys.delete(entry.hdCredentialCacheScopeId);
  }
}

function scheduleHdCredentialDecryptCacheEntryRemoval(
  cacheKey: string,
  entry: IHdCredentialDecryptCacheEntry,
) {
  if (entry.timeout) {
    clearTimeout(entry.timeout);
  }
  const delayMs = Math.max(0, entry.expiresAt - Date.now());
  entry.timeout = setTimeout(() => {
    if (
      hdCredentialDecryptCache.get(cacheKey) === entry &&
      !entry.buffersPromise &&
      entry.expiresAt <= Date.now()
    ) {
      deleteHdCredentialDecryptCacheEntry(cacheKey);
    }
  }, delayMs);
  (
    entry.timeout as ReturnType<typeof setTimeout> & { unref?: () => void }
  ).unref?.();
}

function touchHdCredentialDecryptCacheEntry(
  cacheKey: string,
  entry: IHdCredentialDecryptCacheEntry,
) {
  entry.expiresAt = Date.now() + HD_CREDENTIAL_DECRYPT_CACHE_TTL_MS;
  scheduleHdCredentialDecryptCacheEntryRemoval(cacheKey, entry);
}

function pruneHdCredentialDecryptCache(now = Date.now()) {
  for (const [cacheKey, entry] of hdCredentialDecryptCache) {
    if (!entry.buffersPromise && entry.expiresAt <= now) {
      deleteHdCredentialDecryptCacheEntry(cacheKey);
    }
  }
  while (
    hdCredentialDecryptCache.size > HD_CREDENTIAL_DECRYPT_CACHE_MAX_ENTRIES
  ) {
    const firstKey = hdCredentialDecryptCache.keys().next().value;
    if (!firstKey) {
      break;
    }
    deleteHdCredentialDecryptCacheEntry(firstKey);
  }
}

function getHdCredentialCachedBuffers(
  cacheKey: string,
  entry: IHdCredentialDecryptCacheEntry,
): IHdCredentialDecryptCacheBuffers | undefined {
  if (
    !entry.entropyWithLangPrefixedBuffer ||
    !entry.seedBuffer ||
    entry.buffersPromise
  ) {
    return undefined;
  }
  if (entry.expiresAt <= Date.now()) {
    deleteHdCredentialDecryptCacheEntry(cacheKey);
    return undefined;
  }
  touchHdCredentialDecryptCacheEntry(cacheKey, entry);
  return cloneHdCredentialCacheBuffers({
    entropyWithLangPrefixedBuffer: entry.entropyWithLangPrefixedBuffer,
    seedBuffer: entry.seedBuffer,
  });
}

function setHdCredentialCachedBuffers(
  cacheKey: string,
  entry: IHdCredentialDecryptCacheEntry,
  buffers: IHdCredentialDecryptCacheBuffers,
) {
  zeroHdCredentialCacheBuffers(entry);
  entry.entropyWithLangPrefixedBuffer = Buffer.from(
    buffers.entropyWithLangPrefixedBuffer,
  );
  entry.seedBuffer = Buffer.from(buffers.seedBuffer);
  entry.buffersPromise = undefined;
  touchHdCredentialDecryptCacheEntry(cacheKey, entry);
  pruneHdCredentialDecryptCache();
}

function getCurveByName(curveName: ICurveName): BaseCurve {
  const curve: BaseCurve | undefined = curves.get(curveName);
  if (curve === undefined) {
    throw Error(`Curve ${curveName} is not supported.`);
  }
  return curve;
}

function getDeriverByCurveName(curveName: ICurveName): IBip32KeyDeriver {
  const deriver: IBip32KeyDeriver | undefined = derivers.get(curveName);
  if (deriver === undefined) {
    throw Error(`Key derivation is not supported for curve ${curveName}.`);
  }
  return deriver;
}

function verify(
  curveName: ICurveName,
  publicKey: Buffer,
  digest: Buffer,
  signature: Buffer,
): boolean {
  return getCurveByName(curveName).verify(publicKey, digest, signature);
}

async function sign(
  curveName: ICurveName,
  encryptedPrivateKey: Buffer,
  digest: Buffer,
  password: string,
): Promise<Buffer> {
  const decryptedPrivateKey = await decryptAsync({
    password,
    data: encryptedPrivateKey,
  });
  return getCurveByName(curveName).sign(decryptedPrivateKey, digest);
}

async function publicFromPrivate(
  curveName: ICurveName,
  encryptedPrivateKey: Buffer,
  password: string,
): Promise<Buffer> {
  const decryptedPrivateKey = await decryptAsync({
    password,
    data: bufferUtils.toBuffer(encryptedPrivateKey),
  });

  return getCurveByName(curveName).publicFromPrivate(decryptedPrivateKey);
}

function uncompressPublicKey(curveName: ICurveName, publicKey: Buffer): Buffer {
  if (publicKey.length === 65) {
    return publicKey;
  }
  return getCurveByName(curveName).transformPublicKey(publicKey);
}

function compressPublicKey(curveName: ICurveName, publicKey: Buffer): Buffer {
  if (publicKey.length === 33) {
    return publicKey;
  }
  return getCurveByName(curveName).transformPublicKey(publicKey);
}

function fixV4VerifyStringToV5({ verifyString }: { verifyString: string }) {
  if (verifyString === DEFAULT_VERIFY_STRING) {
    return verifyString;
  }

  return (
    EncryptPrefixVerifyString +
    verifyString.replace(EncryptPrefixVerifyString, '')
  );
}

async function decryptVerifyString({
  password,
  verifyString,
  kdfBackend,
  enablePbkdf2Cache,
  debugCryptoProbeId,
}: {
  verifyString: string;
  password: string;
} & ISecretKdfParams) {
  const decrypted = await decryptAsync({
    password,
    data: Buffer.from(
      verifyString.replace(EncryptPrefixVerifyString, ''),
      'hex',
    ),
    kdfBackend,
    enablePbkdf2Cache,
    debugCryptoProbeId,
  });
  return decrypted.toString();
}

async function decryptVerifyStringWithMetadata({
  password,
  verifyString,
  kdfBackend,
  enablePbkdf2Cache,
  debugCryptoProbeId,
}: {
  verifyString: string;
  password: string;
} & ISecretKdfParams) {
  const result = await decryptAsyncWithMetadata({
    password,
    data: Buffer.from(
      verifyString.replace(EncryptPrefixVerifyString, ''),
      'hex',
    ),
    dataType: 'local-verify-string',
    upgradeTargetIterations: getSecretEncryptV2LocalTargetIterations(),
    kdfBackend,
    enablePbkdf2Cache,
    debugCryptoProbeId,
  });
  return {
    ...result,
    plaintext: result.plaintext.toString(),
  };
}

async function encryptVerifyString({
  password,
  addPrefixString = true,
  allowRawPassword,
  format = ESecretEncryptPayloadFormat.v2,
  kdfBackend,
  enablePbkdf2Cache,
  debugCryptoProbeId,
}: {
  password: string;
  addPrefixString?: boolean;
  allowRawPassword?: boolean;
  format?: ESecretEncryptPayloadFormat;
} & ISecretKdfParams): Promise<string> {
  const encrypted = await encryptAsync({
    password,
    data: Buffer.from(DEFAULT_VERIFY_STRING),
    allowRawPassword,
    format,
    dataType: 'local-verify-string',
    iterations:
      format === ESecretEncryptPayloadFormat.v2
        ? getSecretEncryptV2LocalTargetIterations()
        : undefined,
    kdfBackend,
    enablePbkdf2Cache,
    debugCryptoProbeId,
  });
  return (
    (addPrefixString ? EncryptPrefixVerifyString : '') +
    encrypted.toString('hex')
  );
}

async function decryptRevealableSeed({
  rs,
  password,
  allowRawPassword,
  kdfBackend,
  enablePbkdf2Cache,
  debugCryptoProbeId,
}: {
  rs: IBip39RevealableSeedEncryptHex;
  password: string;
  allowRawPassword?: boolean;
} & ISecretKdfParams): Promise<IBip39RevealableSeed> {
  const decrypted = await decryptAsync({
    allowRawPassword,
    password,
    data: rs.replace(EncryptPrefixHdCredential, ''),
    kdfBackend,
    enablePbkdf2Cache,
    debugCryptoProbeId,
  });
  const rsJsonStr = bufferUtils.bytesToUtf8(decrypted);
  return JSON.parse(rsJsonStr) as IBip39RevealableSeed;
}

async function decryptRevealableSeedWithMetadata({
  rs,
  password,
  allowRawPassword,
  kdfBackend,
  enablePbkdf2Cache,
  debugCryptoProbeId,
}: {
  rs: IBip39RevealableSeedEncryptHex;
  password: string;
  allowRawPassword?: boolean;
} & ISecretKdfParams) {
  const result = await decryptAsyncWithMetadata({
    allowRawPassword,
    password,
    data: rs.replace(EncryptPrefixHdCredential, ''),
    dataType: 'local-revealable-seed',
    upgradeTargetIterations: getSecretEncryptV2LocalTargetIterations(),
    kdfBackend,
    enablePbkdf2Cache,
    debugCryptoProbeId,
  });
  const rsJsonStr = bufferUtils.bytesToUtf8(result.plaintext);
  return {
    ...result,
    plaintext: JSON.parse(rsJsonStr) as IBip39RevealableSeed,
  };
}

async function getHdCredentialDecryptCacheEntry({
  hdCredentialCacheScopeId,
  hdCredential,
  password,
}: IHdCredentialDecryptCacheParams & {
  hdCredential: IBip39RevealableSeedEncryptHex;
  password: string;
}): Promise<
  | {
      cacheKey: string;
      entry: IHdCredentialDecryptCacheEntry;
    }
  | undefined
> {
  if (!hdCredentialCacheScopeId) {
    return undefined;
  }
  pruneHdCredentialDecryptCache();
  const passwordHash = bufferUtils.bytesToHex(
    await hash160(bufferUtils.utf8ToBytes(password)),
  );
  const hdCredentialHash = bufferUtils.bytesToHex(
    await hash160(bufferUtils.utf8ToBytes(hdCredential)),
  );
  const cacheKey = `${hdCredentialCacheScopeId}:${passwordHash}:${hdCredentialHash}`;
  let entry = hdCredentialDecryptCache.get(cacheKey);
  if (!entry) {
    entry = {
      hdCredentialCacheScopeId,
      expiresAt: Number.POSITIVE_INFINITY,
    };
    hdCredentialDecryptCache.set(cacheKey, entry);
    let scopeKeys = hdCredentialDecryptCacheScopeKeys.get(
      hdCredentialCacheScopeId,
    );
    if (!scopeKeys) {
      scopeKeys = new Set<string>();
      hdCredentialDecryptCacheScopeKeys.set(
        hdCredentialCacheScopeId,
        scopeKeys,
      );
    }
    scopeKeys.add(cacheKey);
    pruneHdCredentialDecryptCache();
  }
  return { cacheKey, entry };
}

async function getHdCredentialRevealableSeedBuffersWithCache({
  rs,
  password,
  allowRawPassword,
  hdCredentialCacheScopeId,
  kdfBackend,
  enablePbkdf2Cache,
  debugCryptoProbeId,
}: {
  rs: IBip39RevealableSeedEncryptHex;
  password: string;
  allowRawPassword?: boolean;
} & IHdCredentialDecryptCacheParams &
  ISecretKdfParams): Promise<IHdCredentialDecryptCacheBuffers> {
  const cacheInfo = await getHdCredentialDecryptCacheEntry({
    hdCredentialCacheScopeId,
    hdCredential: rs,
    password,
  });
  if (!cacheInfo) {
    return revealableSeedToCacheBuffers(
      await decryptRevealableSeed({
        rs,
        password,
        allowRawPassword,
        kdfBackend,
        enablePbkdf2Cache,
        debugCryptoProbeId,
      }),
    );
  }

  const { cacheKey, entry } = cacheInfo;
  const cachedBuffers = getHdCredentialCachedBuffers(cacheKey, entry);
  if (cachedBuffers) {
    return cachedBuffers;
  }
  if (hdCredentialDecryptCache.get(cacheKey) !== entry) {
    return getHdCredentialRevealableSeedBuffersWithCache({
      rs,
      password,
      allowRawPassword,
      kdfBackend,
      enablePbkdf2Cache,
      debugCryptoProbeId,
      hdCredentialCacheScopeId,
    });
  }

  if (!entry.buffersPromise) {
    entry.buffersPromise = decryptRevealableSeed({
      rs,
      password,
      allowRawPassword,
      kdfBackend,
      enablePbkdf2Cache,
      debugCryptoProbeId,
    })
      .then((revealableSeed) => {
        const buffers = revealableSeedToCacheBuffers(revealableSeed);
        const result = cloneHdCredentialCacheBuffers(buffers);
        if (hdCredentialDecryptCache.get(cacheKey) === entry) {
          setHdCredentialCachedBuffers(cacheKey, entry, buffers);
        }
        zeroHdCredentialCacheBuffers(buffers);
        return result;
      })
      .catch((error) => {
        if (hdCredentialDecryptCache.get(cacheKey) === entry) {
          deleteHdCredentialDecryptCacheEntry(cacheKey);
        }
        throw error;
      });
  }
  const buffers = await entry.buffersPromise;
  return cloneHdCredentialCacheBuffers(buffers);
}

async function getHdCredentialSeedBufferWithCache({
  hdCredential,
  password,
  hdCredentialCacheScopeId,
  kdfBackend,
  enablePbkdf2Cache,
  debugCryptoProbeId,
}: IHdCredentialDecryptCacheParams & {
  hdCredential: IBip39RevealableSeedEncryptHex;
  password: string;
}): Promise<Buffer> {
  const buffers = await getHdCredentialRevealableSeedBuffersWithCache({
    rs: hdCredential,
    password,
    hdCredentialCacheScopeId,
    kdfBackend,
    enablePbkdf2Cache,
    debugCryptoProbeId,
  });
  try {
    return Buffer.from(buffers.seedBuffer);
  } finally {
    zeroHdCredentialCacheBuffers(buffers);
  }
}

async function clearPbkdf2CacheAsync(): Promise<void> {
  clearPbkdf2Cache();

  if (
    platformEnv.isNative &&
    !platformEnv.isWebEmbed &&
    !platformEnv.isJest &&
    !globalThis.$onekeyAppWebembedApiWebviewInitFailed
  ) {
    await appGlobals.$webembedApiProxy.secret.clearPbkdf2Cache();
  }
}

async function clearHdCredentialDecryptCache({
  hdCredentialCacheScopeId,
}: IClearHdCredentialDecryptCacheParams): Promise<void> {
  const scopeKeys = hdCredentialDecryptCacheScopeKeys.get(
    hdCredentialCacheScopeId,
  );
  if (scopeKeys) {
    for (const cacheKey of Array.from(scopeKeys)) {
      deleteHdCredentialDecryptCacheEntry(cacheKey);
    }
    hdCredentialDecryptCacheScopeKeys.delete(hdCredentialCacheScopeId);
  }

  if (
    platformEnv.isNative &&
    !platformEnv.isWebEmbed &&
    !platformEnv.isJest &&
    !globalThis.$onekeyAppWebembedApiWebviewInitFailed
  ) {
    await appGlobals.$webembedApiProxy.secret.clearHdCredentialDecryptCache({
      hdCredentialCacheScopeId,
    });
  }
}

async function encryptRevealableSeed({
  rs,
  password,
  format = ESecretEncryptPayloadFormat.v2,
  kdfBackend,
  enablePbkdf2Cache,
  debugCryptoProbeId,
}: {
  rs: IBip39RevealableSeed;
  password: string;
  format?: ESecretEncryptPayloadFormat;
} & ISecretKdfParams): Promise<IBip39RevealableSeedEncryptHex> {
  if (!rs || !rs.entropyWithLangPrefixed || !rs.seed) {
    throw new OneKeyLocalError('Invalid seed object');
  }
  const encrypted = await encryptStringAsync({
    password,
    data: JSON.stringify(rs),
    dataEncoding: 'utf8',
    format,
    dataType: 'local-revealable-seed',
    iterations:
      format === ESecretEncryptPayloadFormat.v2
        ? getSecretEncryptV2LocalTargetIterations()
        : undefined,
    kdfBackend,
    enablePbkdf2Cache,
    debugCryptoProbeId,
  });
  return EncryptPrefixHdCredential + bufferUtils.bytesToHex(encrypted);
}

async function decryptImportedCredential({
  credential,
  password,
  allowRawPassword,
  kdfBackend,
  enablePbkdf2Cache,
  debugCryptoProbeId,
}: {
  credential: ICoreImportedCredentialEncryptHex;
  password: string;
  allowRawPassword?: boolean;
} & ISecretKdfParams): Promise<ICoreImportedCredential> {
  const decrypted = await decryptAsync({
    allowRawPassword,
    password,
    data:
      typeof credential === 'string'
        ? credential.replace(EncryptPrefixImportedCredential, '')
        : credential,
    kdfBackend,
    enablePbkdf2Cache,
    debugCryptoProbeId,
  });
  const text = bufferUtils.bytesToUtf8(decrypted);
  return JSON.parse(text) as ICoreImportedCredential;
}

async function decryptImportedCredentialWithMetadata({
  credential,
  password,
  allowRawPassword,
  kdfBackend,
  enablePbkdf2Cache,
  debugCryptoProbeId,
}: {
  credential: ICoreImportedCredentialEncryptHex;
  password: string;
  allowRawPassword?: boolean;
} & ISecretKdfParams) {
  const result = await decryptAsyncWithMetadata({
    allowRawPassword,
    password,
    data:
      typeof credential === 'string'
        ? credential.replace(EncryptPrefixImportedCredential, '')
        : credential,
    dataType: 'local-imported-credential',
    upgradeTargetIterations: getSecretEncryptV2LocalTargetIterations(),
    kdfBackend,
    enablePbkdf2Cache,
    debugCryptoProbeId,
  });
  const text = bufferUtils.bytesToUtf8(result.plaintext);
  return {
    ...result,
    plaintext: JSON.parse(text) as ICoreImportedCredential,
  };
}

async function encryptImportedCredential({
  credential,
  password,
  allowRawPassword,
  format = ESecretEncryptPayloadFormat.v2,
  kdfBackend,
  enablePbkdf2Cache,
  debugCryptoProbeId,
}: {
  credential: ICoreImportedCredential;
  password: string;
  allowRawPassword?: boolean;
  format?: ESecretEncryptPayloadFormat;
} & ISecretKdfParams): Promise<ICoreImportedCredentialEncryptHex> {
  if (!credential || !credential.privateKey) {
    throw new OneKeyLocalError('Invalid credential object');
  }
  const encrypted = await encryptStringAsync({
    allowRawPassword,
    password,
    data: JSON.stringify(credential),
    dataEncoding: 'utf8',
    format,
    dataType: 'local-imported-credential',
    iterations:
      format === ESecretEncryptPayloadFormat.v2
        ? getSecretEncryptV2LocalTargetIterations()
        : undefined,
    kdfBackend,
    enablePbkdf2Cache,
    debugCryptoProbeId,
  });
  return EncryptPrefixImportedCredential + encrypted;
}

async function decryptHyperLiquidAgentCredential({
  credential,
  password,
  allowRawPassword,
}: {
  credential: ICoreHyperLiquidAgentCredentialEncryptHex;
  password?: string;
  allowRawPassword?: boolean;
}): Promise<ICoreHyperLiquidAgentCredential | undefined> {
  try {
    // Check |HLP| before |HL| — |HLP| starts with |HL|, so order matters
    if (credential.startsWith(EncryptPrefixHyperLiquidAgentCredentialPlain)) {
      const text = credential.replace(
        EncryptPrefixHyperLiquidAgentCredentialPlain,
        '',
      );
      return JSON.parse(text) as ICoreHyperLiquidAgentCredential;
    }
    // Legacy encrypted format
    if (credential.startsWith(EncryptPrefixHyperLiquidAgentCredential)) {
      if (!password) {
        defaultLogger.perp.agentLifeCycle.trackReason({
          reason: 'credential_legacy_no_password',
        });
        return undefined;
      }
      const decrypted = await decryptAsync({
        allowRawPassword,
        password,
        data: credential.replace(EncryptPrefixHyperLiquidAgentCredential, ''),
      });
      const text = bufferUtils.bytesToUtf8(decrypted);
      return JSON.parse(text) as ICoreHyperLiquidAgentCredential;
    }
    // Unknown format
    defaultLogger.perp.agentLifeCycle.trackReason({
      reason: 'credential_unknown_format',
    });
  } catch (e) {
    defaultLogger.perp.agentLifeCycle.trackReason({
      reason: 'credential_decrypt_corrupted',
      statusDetails: {
        errorMessage: e instanceof Error ? e.message : String(e),
      },
    });
  }
  return undefined;
}

// Plaintext |HLP| prefix + JSON. Synchronous — no AES encryption involved.
function encryptHyperLiquidAgentCredential({
  credential,
}: {
  credential: ICoreHyperLiquidAgentCredential;
}): ICoreHyperLiquidAgentCredentialEncryptHex {
  if (!credential || !credential.privateKey) {
    throw new OneKeyLocalError('Invalid credential object');
  }
  return (
    EncryptPrefixHyperLiquidAgentCredentialPlain + JSON.stringify(credential)
  );
}

async function batchGetKeys(
  curveName: ICurveName,
  hdCredential: ICoreHdCredentialEncryptHex,
  password: string,
  prefix: string,
  relPaths: Array<string>,
  type: 'public' | 'private',
  hdCredentialCacheScopeId?: string,
  kdfBackend?: IPbkdf2DispatchBackend,
  enablePbkdf2Cache?: boolean,
  debugCryptoProbeId?: string,
  perfTrace?: IBatchGetPublicKeysPerfTrace,
): Promise<
  Array<{
    path: string;
    parentFingerPrint: Buffer;
    extendedKey: IBip32ExtendedKey;
  }>
> {
  return traceBatchGetPublicKeysAsync({
    perfTrace,
    name: 'batchGetKeys.total',
    metadata: {
      curveName,
      relPathCount: relPaths.length,
      type,
    },
    fn: async () => {
      const bip32PerfTrace = createBip32PerfTrace(perfTrace);
      const deriver: IBip32KeyDeriver = getDeriverByCurveName(curveName);
      const seedBuffer: Buffer = await traceBatchGetPublicKeysAsync({
        perfTrace,
        name: 'batchGetKeys.getHdCredentialSeedBufferWithCache',
        fn: () =>
          getHdCredentialSeedBufferWithCache({
            hdCredential,
            password,
            hdCredentialCacheScopeId,
            kdfBackend,
            enablePbkdf2Cache,
            debugCryptoProbeId,
          }),
      });

      // Generate master key
      const batchGetKeysBip32Options = {
        perfTrace: bip32PerfTrace,
        validatePublicKey: false,
      };
      let key: IBip32ExtendedKey = traceBatchGetPublicKeys({
        perfTrace,
        name: 'batchGetKeys.generateMasterKeyFromSeed',
        fn: () =>
          deriver.generateMasterKeyFromSeed(seedBuffer, {
            perfTrace: bip32PerfTrace,
          }),
      });

      // Process prefix path components
      const prefixComponents = traceBatchGetPublicKeys({
        perfTrace,
        name: 'batchGetKeys.parsePrefixPath',
        fn: () => prefix.split('/').filter((p) => p !== 'm'),
      });
      const indices = prefixComponents.map((p) =>
        p.endsWith("'")
          ? Number.parseInt(p.slice(0, -1), 10) + 2 ** 31
          : Number.parseInt(p, 10),
      );

      // Derive prefix path key
      traceBatchGetPublicKeys({
        perfTrace,
        name: 'batchGetKeys.derivePrefixPath',
        metadata: {
          depth: indices.length,
        },
        fn: () => {
          for (const index of indices) {
            key = deriver.CKDPriv(key, index, batchGetKeysBip32Options);
          }
        },
      });

      const cache: Record<
        string,
        {
          fingerPrint: Buffer | undefined;
          parentFingerPrint: Buffer;
          privkey: IBip32ExtendedKey;
        }
      > = {};

      const prefixPublicKey = traceBatchGetPublicKeys({
        perfTrace,
        name: 'batchGetKeys.prefixPublicKey',
        fn: () => deriver.N(key, batchGetKeysBip32Options),
      });

      // Initialize cache with prefix key
      cache[prefix] = {
        fingerPrint: traceBatchGetPublicKeys({
          perfTrace,
          name: 'batchGetKeys.prefixHash160',
          fn: () => hash160Sync(prefixPublicKey.key).slice(0, 4),
        }),
        parentFingerPrint: Buffer.from([]),
        privkey: key,
      };

      // Process all relative paths in parallel
      const results = relPaths.map(async (relPath) => {
        const pathComponents = relPath.split('/');
        const start = perfTrace ? perfTraceNowMs() : 0;
        try {
          let currentPath = prefix;
          let parent = cache[currentPath];

          // Process path components sequentially within each path
          for (const pathComponent of pathComponents) {
            currentPath = `${currentPath}/${pathComponent}`;
            if (typeof cache[currentPath] === 'undefined') {
              const index = pathComponent.endsWith("'")
                ? parseInt(pathComponent.slice(0, -1), 10) + 2 ** 31
                : parseInt(pathComponent, 10);
              const privkey = deriver.CKDPriv(
                parent.privkey,
                index,
                batchGetKeysBip32Options,
              );

              if (typeof parent.fingerPrint === 'undefined') {
                const parentForFingerPrint = parent;
                const parentPublicKey = traceBatchGetPublicKeys({
                  perfTrace,
                  name: 'batchGetKeys.parentPublicKey',
                  fn: () =>
                    deriver.N(
                      parentForFingerPrint.privkey,
                      batchGetKeysBip32Options,
                    ),
                });
                parentForFingerPrint.fingerPrint = traceBatchGetPublicKeys({
                  perfTrace,
                  name: 'batchGetKeys.parentHash160',
                  fn: () => hash160Sync(parentPublicKey.key).slice(0, 4),
                });
              }
              const parentFingerPrint = parent.fingerPrint;
              if (typeof parentFingerPrint === 'undefined') {
                throw new OneKeyLocalError(
                  'batchGetKeys parent fingerprint missing',
                );
              }

              cache[currentPath] = {
                fingerPrint: undefined,
                parentFingerPrint,
                privkey,
              };
            }
            parent = cache[currentPath];
          }

          // Generate extended key
          const extendedKey =
            type === 'private'
              ? await traceBatchGetPublicKeysAsync({
                  perfTrace,
                  name: 'batchGetKeys.encryptPrivateExtendedKey',
                  fn: async () => ({
                    chainCode: cache[currentPath].privkey.chainCode,
                    key: await encryptAsync({
                      password,
                      data: cache[currentPath].privkey.key,
                      kdfBackend,
                      enablePbkdf2Cache,
                      debugCryptoProbeId,
                    }),
                  }),
                })
              : traceBatchGetPublicKeys({
                  perfTrace,
                  name: 'batchGetKeys.publicExtendedKey',
                  fn: () =>
                    deriver.N(
                      cache[currentPath].privkey,
                      batchGetKeysBip32Options,
                    ),
                });

          return {
            path: currentPath,
            parentFingerPrint: cache[currentPath].parentFingerPrint,
            extendedKey,
          };
        } finally {
          if (perfTrace) {
            perfTrace.onEvent({
              source: 'batchGetKeys',
              name: 'batchGetKeys.relPath.total',
              durationMs: perfTraceNowMs() - start,
              metadata: {
                depth: pathComponents.length,
              },
            });
          }
        }
      });

      return Promise.all(results);
    },
  });
}

async function batchGetKeysByAsyncSubCalls(
  curveName: ICurveName,
  hdCredential: ICoreHdCredentialEncryptHex,
  password: string,
  prefix: string,
  relPaths: Array<string>,
  type: 'public' | 'private',
  hdCredentialCacheScopeId?: string,
  kdfBackend?: IPbkdf2DispatchBackend,
  enablePbkdf2Cache?: boolean,
  debugCryptoProbeId?: string,
): Promise<
  Array<{
    path: string;
    parentFingerPrint: Buffer;
    extendedKey: IBip32ExtendedKey;
  }>
> {
  const deriver: IBip32KeyDeriver = getDeriverByCurveName(curveName);
  const seedBuffer: Buffer = await getHdCredentialSeedBufferWithCache({
    hdCredential,
    password,
    hdCredentialCacheScopeId,
    kdfBackend,
    enablePbkdf2Cache,
    debugCryptoProbeId,
  });

  // Generate master key
  let key: IBip32ExtendedKey =
    await deriver.generateMasterKeyFromSeedAsync(seedBuffer);

  // Process prefix path components
  const prefixComponents = prefix.split('/').filter((p) => p !== 'm');
  const indices = prefixComponents.map((p) =>
    p.endsWith("'")
      ? Number.parseInt(p.slice(0, -1), 10) + 2 ** 31
      : Number.parseInt(p, 10),
  );

  // Derive prefix path key
  for (const index of indices) {
    // TODO await
    key = deriver.CKDPriv(key, index);
  }

  const cache: Record<
    string,
    {
      fingerPrint: Buffer | undefined;
      parentFingerPrint: Buffer;
      privkey: IBip32ExtendedKey;
    }
  > = {};

  // Initialize cache with prefix key
  cache[prefix] = {
    fingerPrint: (await hash160(deriver.N(key).key)).slice(0, 4),
    parentFingerPrint: Buffer.from([]),
    privkey: key,
  };

  // Process all relative paths in parallel
  const results = relPaths.map(async (relPath) => {
    const pathComponents = relPath.split('/');
    let currentPath = prefix;
    let parent = cache[currentPath];

    // Process path components sequentially within each path
    for (const pathComponent of pathComponents) {
      currentPath = `${currentPath}/${pathComponent}`;
      if (typeof cache[currentPath] === 'undefined') {
        const index = pathComponent.endsWith("'")
          ? parseInt(pathComponent.slice(0, -1), 10) + 2 ** 31
          : parseInt(pathComponent, 10);

        // TODO await
        const privkey = deriver.CKDPriv(parent.privkey, index);

        if (typeof parent.fingerPrint === 'undefined') {
          parent.fingerPrint = (
            await hash160(deriver.N(parent.privkey).key)
          ).slice(0, 4);
        }

        cache[currentPath] = {
          fingerPrint: undefined,
          parentFingerPrint: parent.fingerPrint,
          privkey,
        };
      }
      parent = cache[currentPath];
    }

    // Generate extended key
    const extendedKey =
      type === 'private'
        ? {
            chainCode: cache[currentPath].privkey.chainCode,
            key: await encryptAsync({
              password,
              data: cache[currentPath].privkey.key,
              kdfBackend,
              enablePbkdf2Cache,
              debugCryptoProbeId,
            }),
          }
        : deriver.N(cache[currentPath].privkey); // TODO await

    return {
      path: currentPath,
      parentFingerPrint: cache[currentPath].parentFingerPrint,
      extendedKey,
    };
  });

  return Promise.all(results);
}

export type ISecretPrivateKeyInfo = {
  path: string;
  parentFingerPrint: Buffer;
  extendedKey: IBip32ExtendedKey;
};
async function batchGetPrivateKeys(
  curveName: ICurveName,
  hdCredential: ICoreHdCredentialEncryptHex,
  password: string,
  prefix: string,
  relPaths: Array<string>,
  hdCredentialCacheScopeId?: string,
  kdfBackend?: IPbkdf2DispatchBackend,
  enablePbkdf2Cache?: boolean,
  debugCryptoProbeId?: string,
): Promise<ISecretPrivateKeyInfo[]> {
  return batchGetKeys(
    curveName,
    hdCredential,
    password,
    prefix,
    relPaths,
    'private',
    hdCredentialCacheScopeId,
    kdfBackend,
    enablePbkdf2Cache,
    debugCryptoProbeId,
  );
}

export type ISecretPublicKeyInfoSerialized = {
  path: string;
  parentFingerPrint: string;
  extendedKey: IBip32ExtendedKeySerialized;
};
export type ISecretPublicKeyInfo = {
  path: string;
  parentFingerPrint: Buffer;
  extendedKey: IBip32ExtendedKey;
};

export type IBatchGetPublicKeysParams = {
  curveName: ICurveName;
  hdCredential: ICoreHdCredentialEncryptHex;
  password: string;
  prefix: string;
  relPaths: Array<string>;
  byAsyncSubCalls?: boolean;
  perfTrace?: IBatchGetPublicKeysPerfTrace;
  useWebembedApi?: boolean; // webembedApi is default to false
} & IHdCredentialDecryptCacheParams &
  ISecretKdfParams;

type IBatchGetPublicKeysSerializableParams = Omit<
  IBatchGetPublicKeysParams,
  'perfTrace'
>;

function getBatchGetPublicKeysSerializableParams({
  curveName,
  hdCredential,
  password,
  prefix,
  relPaths,
  byAsyncSubCalls,
  useWebembedApi,
  hdCredentialCacheScopeId,
  kdfBackend,
  enablePbkdf2Cache,
  debugCryptoProbeId,
}: IBatchGetPublicKeysParams): IBatchGetPublicKeysSerializableParams {
  return {
    curveName,
    hdCredential,
    password,
    prefix,
    relPaths,
    byAsyncSubCalls,
    useWebembedApi,
    hdCredentialCacheScopeId,
    kdfBackend,
    enablePbkdf2Cache,
    debugCryptoProbeId,
  };
}

async function batchGetPublicKeys(
  params: IBatchGetPublicKeysParams,
): Promise<ISecretPublicKeyInfo[]> {
  const {
    curveName,
    hdCredential,
    password,
    prefix,
    relPaths,
    hdCredentialCacheScopeId,
    kdfBackend,
    enablePbkdf2Cache,
    debugCryptoProbeId,
    perfTrace,
  } = params;
  const { useWebembedApi } = params;

  if (
    useWebembedApi &&
    platformEnv.isNative &&
    !platformEnv.isJest &&
    !globalThis.$onekeyAppWebembedApiWebviewInitFailed
  ) {
    const keys = await appGlobals.$webembedApiProxy.secret.batchGetPublicKeys(
      getBatchGetPublicKeysSerializableParams(params),
    );
    return keys.map((key) => ({
      path: key.path,
      parentFingerPrint: Buffer.from(key.parentFingerPrint, 'hex'),
      extendedKey: {
        key: Buffer.from(key.extendedKey.key, 'hex'),
        chainCode: Buffer.from(key.extendedKey.chainCode, 'hex'),
      },
    }));
  }

  if (params.byAsyncSubCalls) {
    return batchGetKeysByAsyncSubCalls(
      curveName,
      hdCredential,
      password,
      prefix,
      relPaths,
      'public',
      hdCredentialCacheScopeId,
      kdfBackend,
      enablePbkdf2Cache,
      debugCryptoProbeId,
    );
  }

  return batchGetKeys(
    curveName,
    hdCredential,
    password,
    prefix,
    relPaths,
    'public',
    hdCredentialCacheScopeId,
    kdfBackend,
    enablePbkdf2Cache,
    debugCryptoProbeId,
    perfTrace,
  );
}

async function generateMasterKeyFromSeed(
  curveName: ICurveName,
  hdCredential: IBip39RevealableSeedEncryptHex,
  password: string,
  hdCredentialCacheScopeId?: string,
): Promise<IBip32ExtendedKey> {
  const deriver: IBip32KeyDeriver = getDeriverByCurveName(curveName);
  const seedBuffer: Buffer = await getHdCredentialSeedBufferWithCache({
    hdCredential,
    password,
    hdCredentialCacheScopeId,
  });
  const masterKey: IBip32ExtendedKey =
    await deriver.generateMasterKeyFromSeedAsync(seedBuffer);
  const encryptedKey = await encryptAsync({
    password,
    data: bufferUtils.toBuffer(masterKey.key),
  });
  return {
    key: bufferUtils.toBuffer(encryptedKey),
    chainCode: bufferUtils.toBuffer(masterKey.chainCode),
  };
}

async function N(
  curveName: ICurveName,
  encryptedExtPriv: IBip32ExtendedKey,
  password: string,
): Promise<IBip32ExtendedKey> {
  if (!platformEnv.isJest) {
    ensureSensitiveTextEncoded(password);
  }
  const deriver: IBip32KeyDeriver = getDeriverByCurveName(curveName);
  const extPriv: IBip32ExtendedKey = {
    key: await decryptAsync({
      password,
      data: encryptedExtPriv.key,
    }),
    chainCode: encryptedExtPriv.chainCode,
  };
  return deriver.N(extPriv);
}

async function CKDPriv(
  curveName: ICurveName,
  encryptedParent: IBip32ExtendedKey,
  index: number,
  password: string,
): Promise<IBip32ExtendedKey> {
  const deriver: IBip32KeyDeriver = getDeriverByCurveName(curveName);
  const parent: IBip32ExtendedKey = {
    key: await decryptAsync({
      password,
      data: encryptedParent.key,
    }),
    chainCode: encryptedParent.chainCode,
  };
  const child: IBip32ExtendedKey = deriver.CKDPriv(parent, index);
  const encryptedKey = await encryptAsync({
    password,
    data: child.key,
  });
  return {
    key: encryptedKey,
    chainCode: child.chainCode,
  };
}

async function CKDPub(
  curveName: ICurveName,
  parent: IBip32ExtendedKey,
  index: number,
): Promise<IBip32ExtendedKey> {
  return getDeriverByCurveName(curveName).CKDPub(parent, index);
}

async function revealableSeedFromMnemonic(
  mnemonic: string,
  password: string,
  passphrase?: string,
): Promise<IBip39RevealableSeedEncryptHex> {
  const rs: IBip39RevealableSeed = mnemonicToRevealableSeed(
    mnemonic,
    passphrase,
  );
  return encryptRevealableSeed({
    rs,
    password,
  });
}

async function mnemonicFromEntropy(
  hdCredential: IBip39RevealableSeedEncryptHex,
  password: string,
  options?: IHdCredentialDecryptCacheParams,
): Promise<string> {
  defaultLogger.account.secretPerf.decryptHdCredential();
  const buffers = await getHdCredentialRevealableSeedBuffersWithCache({
    password,
    rs: hdCredential,
    hdCredentialCacheScopeId: options?.hdCredentialCacheScopeId,
    kdfBackend: options?.kdfBackend,
    enablePbkdf2Cache: options?.enablePbkdf2Cache,
    debugCryptoProbeId: options?.debugCryptoProbeId,
  });
  defaultLogger.account.secretPerf.decryptHdCredentialDone();

  try {
    defaultLogger.account.secretPerf.revealEntropyToMnemonic();
    const r = revealEntropyToMnemonic(buffers.entropyWithLangPrefixedBuffer);
    defaultLogger.account.secretPerf.revealEntropyToMnemonicDone();
    return r;
  } finally {
    zeroHdCredentialCacheBuffers(buffers);
  }
}

async function rawEntropyFromHdCredential(
  hdCredential: IBip39RevealableSeedEncryptHex,
  password: string,
  options?: IHdCredentialDecryptCacheParams,
): Promise<Buffer> {
  defaultLogger.account.secretPerf.decryptHdCredential();
  const buffers = await getHdCredentialRevealableSeedBuffersWithCache({
    password,
    rs: hdCredential,
    hdCredentialCacheScopeId: options?.hdCredentialCacheScopeId,
    kdfBackend: options?.kdfBackend,
    enablePbkdf2Cache: options?.enablePbkdf2Cache,
    debugCryptoProbeId: options?.debugCryptoProbeId,
  });
  defaultLogger.account.secretPerf.decryptHdCredentialDone();

  try {
    return revealEntropyToRawEntropy(buffers.entropyWithLangPrefixedBuffer);
  } finally {
    zeroHdCredentialCacheBuffers(buffers);
  }
}

export type IMnemonicFromEntropyAsyncParams = {
  hdCredential: IBip39RevealableSeedEncryptHex;
  password: string;
  useWebembedApi?: boolean; // webembedApi is default to false
} & IHdCredentialDecryptCacheParams;
async function mnemonicFromEntropyAsync(
  params: IMnemonicFromEntropyAsyncParams,
): Promise<string> {
  const { useWebembedApi } = params;
  if (
    useWebembedApi &&
    platformEnv.isNative &&
    !platformEnv.isJest &&
    !globalThis.$onekeyAppWebembedApiWebviewInitFailed
  ) {
    return appGlobals.$webembedApiProxy.secret.mnemonicFromEntropyAsync(params);
  }
  return Promise.resolve(
    mnemonicFromEntropy(params.hdCredential, params.password, {
      hdCredentialCacheScopeId: params.hdCredentialCacheScopeId,
      kdfBackend: params.kdfBackend,
      enablePbkdf2Cache: params.enablePbkdf2Cache,
      debugCryptoProbeId: params.debugCryptoProbeId,
    }),
  );
}

export type ISeedFromHdCredentialAsyncParams = {
  hdCredential: IBip39RevealableSeedEncryptHex;
  password: string;
  useWebembedApi?: boolean; // webembedApi is default to false
} & IHdCredentialDecryptCacheParams;
async function seedFromHdCredentialAsync(
  params: ISeedFromHdCredentialAsyncParams,
): Promise<Buffer> {
  const { useWebembedApi } = params;
  if (
    useWebembedApi &&
    platformEnv.isNative &&
    !platformEnv.isJest &&
    !globalThis.$onekeyAppWebembedApiWebviewInitFailed
  ) {
    const hex =
      await appGlobals.$webembedApiProxy.secret.seedFromHdCredentialAsync(
        params,
      );
    return Buffer.from(hex, 'hex');
  }
  return getHdCredentialSeedBufferWithCache({
    hdCredential: params.hdCredential,
    password: params.password,
    hdCredentialCacheScopeId: params.hdCredentialCacheScopeId,
    kdfBackend: params.kdfBackend,
    enablePbkdf2Cache: params.enablePbkdf2Cache,
    debugCryptoProbeId: params.debugCryptoProbeId,
  });
}

export type IMnemonicToSeedAsyncParams = {
  mnemonic: string;
  passphrase?: string;
  perfTrace?: IMnemonicToSeedPerfTrace;
  kdfBackend?: IMnemonicToSeedKdfBackend;
  useWebembedApi?: boolean; // webembedApi is default to false
};
async function mnemonicToSeedAsync(
  params: IMnemonicToSeedAsyncParams,
): Promise<Buffer> {
  const { perfTrace, useWebembedApi } = params;
  if (
    useWebembedApi &&
    platformEnv.isNative &&
    !platformEnv.isJest &&
    !globalThis.$onekeyAppWebembedApiWebviewInitFailed
  ) {
    const { kdfBackend, mnemonic, passphrase } = params;
    const hex = await appGlobals.$webembedApiProxy.secret.mnemonicToSeedAsync({
      kdfBackend,
      mnemonic,
      passphrase,
      useWebembedApi,
    });
    return Buffer.from(hex, 'hex');
  }
  const validateStart = perfTrace ? perfTraceNowMs() : 0;
  let isValid = false;
  try {
    isValid = validateMnemonic(params.mnemonic);
  } finally {
    if (perfTrace) {
      perfTrace.onEvent({
        source: 'mnemonic',
        name: 'mnemonicToSeedAsync.validateMnemonic',
        durationMs: perfTraceNowMs() - validateStart,
      });
    }
  }
  if (!isValid) {
    throw new InvalidMnemonic();
  }
  return mnemonicToSeed(
    params.mnemonic,
    params.passphrase,
    perfTrace,
    params.kdfBackend,
  );
  // return Promise.resolve(
  //   mnemonicToSeedSync(params.mnemonic, params.passphrase),
  // );
}

export type IGenerateRootFingerprintHexAsyncParams = {
  curveName: ICurveName;
  hdCredential: IBip39RevealableSeedEncryptHex;
  password: string;
  useWebembedApi?: boolean; // webembedApi is default to false
} & IHdCredentialDecryptCacheParams;
async function generateRootFingerprintHexAsync(
  params: IGenerateRootFingerprintHexAsyncParams,
): Promise<string> {
  const { useWebembedApi } = params;
  if (
    useWebembedApi &&
    platformEnv.isNative &&
    !platformEnv.isJest &&
    !globalThis.$onekeyAppWebembedApiWebviewInitFailed
  ) {
    return appGlobals.$webembedApiProxy.secret.generateRootFingerprintHexAsync(
      params,
    );
  }
  const { curveName, hdCredential, password } = params;
  const deriver: IBip32KeyDeriver = getDeriverByCurveName(curveName);
  const seedBuffer: Buffer = await getHdCredentialSeedBufferWithCache({
    hdCredential,
    password,
    hdCredentialCacheScopeId: params.hdCredentialCacheScopeId,
    kdfBackend: params.kdfBackend,
    enablePbkdf2Cache: params.enablePbkdf2Cache,
    debugCryptoProbeId: params.debugCryptoProbeId,
  });
  try {
    const masterKey: IBip32ExtendedKey =
      await deriver.generateMasterKeyFromSeedAsync(seedBuffer);
    const publicKey = deriver.N(masterKey).key;
    const r = bufferUtils
      .toBuffer(await hash160(bufferUtils.toBuffer(publicKey)))
      .slice(0, 4)
      .toString('hex');
    return r;
  } finally {
    seedBuffer.fill(0);
  }
}

async function revealableSeedFromTonMnemonic(
  mnemonic: string,
  password: string,
): Promise<IBip39RevealableSeedEncryptHex> {
  const rs: IBip39RevealableSeed = tonMnemonicToRevealableSeed(mnemonic);
  return encryptRevealableSeed({
    rs,
    password,
  });
}

async function tonMnemonicFromEntropy(
  hdCredential: IBip39RevealableSeedEncryptHex,
  password: string,
): Promise<string> {
  defaultLogger.account.secretPerf.decryptHdCredential();
  const rs: IBip39RevealableSeed = await decryptRevealableSeed({
    password,
    rs: hdCredential,
  });
  defaultLogger.account.secretPerf.decryptHdCredentialDone();

  defaultLogger.account.secretPerf.revealEntropyToMnemonic();
  const r = tonRevealEntropyToMnemonic(
    bufferUtils.toBuffer(rs.entropyWithLangPrefixed),
  );
  defaultLogger.account.secretPerf.revealEntropyToMnemonicDone();

  return r;
}

export {
  batchGetPrivateKeys,
  batchGetPublicKeys,
  CKDPriv,
  CKDPub,
  clearHdCredentialDecryptCache,
  clearPbkdf2CacheAsync,
  compressPublicKey,
  decryptHyperLiquidAgentCredential,
  decryptImportedCredential,
  decryptImportedCredentialWithMetadata,
  decryptRevealableSeed,
  decryptRevealableSeedWithMetadata,
  decryptVerifyString,
  decryptVerifyStringWithMetadata,
  encryptHyperLiquidAgentCredential,
  encryptImportedCredential,
  encryptRevealableSeed,
  encryptVerifyString,
  fixV4VerifyStringToV5,
  generateMasterKeyFromSeed,
  generateRootFingerprintHexAsync,
  mnemonicFromEntropy,
  mnemonicFromEntropyAsync,
  mnemonicToSeedAsync,
  N,
  publicFromPrivate,
  rawEntropyFromHdCredential,
  revealableSeedFromMnemonic,
  revealableSeedFromTonMnemonic,
  seedFromHdCredentialAsync,
  sign,
  tonMnemonicFromEntropy,
  uncompressPublicKey,
  verify,
};
