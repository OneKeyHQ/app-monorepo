import { DEFAULT_VERIFY_STRING } from '@onekeyhq/shared/src/consts/dbConsts';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import { BaseBip32KeyDeriver, ED25519Bip32KeyDeriver } from './bip32';
import {
  mnemonicToRevealableSeed,
  mnemonicToSeedSync,
  revealEntropyToMnemonic,
} from './bip39';
import { ed25519, nistp256, secp256k1 } from './curves';
import {
  decrypt,
  encrypt,
  encryptString,
  ensureSensitiveTextEncoded,
} from './encryptors/aes256';
import { hash160 } from './hash';
import ecc from './nobleSecp256k1Wrapper';
import {
  tonMnemonicToRevealableSeed,
  tonRevealEntropyToMnemonic,
} from './ton-mnemonic';

import type {
  IBip32ExtendedKey,
  IBip32ExtendedKeySerialized,
  IBip32KeyDeriver,
} from './bip32';
import type {
  IBip39RevealableSeed,
  IBip39RevealableSeedEncryptHex,
} from './bip39';
import type { BaseCurve } from './curves';
import type {
  ICoreHdCredentialEncryptHex,
  ICoreImportedCredential,
  ICoreImportedCredentialEncryptHex,
  ICurveName,
} from '../types';

export * from './bip32';
export * from './bip340';
export * from './bip39';
export * from './curves';
export * from './encryptors/aes256';
export * from './encryptors/rsa';
export * from './hash';
export * from './ton-mnemonic';
export { ecc };

export enum EMnemonicType {
  BIP39 = 'bip39',
  TON = 'ton',
}

const EncryptPrefixImportedCredential = '|PK|'; // private key
const EncryptPrefixHdCredential = '|RP|'; // recovery phrase
const EncryptPrefixVerifyString = '|VS|'; // verify string

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

function sign(
  curveName: ICurveName,
  encryptedPrivateKey: Buffer,
  digest: Buffer,
  password: string,
): Buffer {
  return getCurveByName(curveName).sign(
    decrypt(password, encryptedPrivateKey),
    digest,
  );
}

function publicFromPrivate(
  curveName: ICurveName,
  encryptedPrivateKey: Buffer,
  password: string,
): Buffer {
  return getCurveByName(curveName).publicFromPrivate(
    decrypt(password, encryptedPrivateKey),
  );
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

function decryptVerifyString({
  password,
  verifyString,
}: {
  verifyString: string;
  password: string;
}) {
  return decrypt(
    password,
    Buffer.from(verifyString.replace(EncryptPrefixVerifyString, ''), 'hex'),
  ).toString();
}

function encryptVerifyString({
  password,
  addPrefixString = true,
}: {
  password: string;
  addPrefixString?: boolean;
}) {
  return (
    (addPrefixString ? EncryptPrefixVerifyString : '') +
    encrypt(password, Buffer.from(DEFAULT_VERIFY_STRING)).toString('hex')
  );
}

function decryptRevealableSeed({
  rs,
  password,
}: {
  rs: IBip39RevealableSeedEncryptHex;
  password: string;
}): IBip39RevealableSeed {
  const rsJsonStr = bufferUtils.bytesToUtf8(
    decrypt(password, rs.replace(EncryptPrefixHdCredential, '')),
  );
  return JSON.parse(rsJsonStr) as IBip39RevealableSeed;
}

function encryptRevealableSeed({
  rs,
  password,
}: {
  rs: IBip39RevealableSeed;
  password: string;
}): IBip39RevealableSeedEncryptHex {
  return (
    EncryptPrefixHdCredential +
    bufferUtils.bytesToHex(
      encryptString({
        password,
        data: JSON.stringify(rs),
        dataEncoding: 'utf8',
      }),
    )
  );
}

function decryptImportedCredential({
  credential,
  password,
}: {
  credential: ICoreImportedCredentialEncryptHex;
  password: string;
}): ICoreImportedCredential {
  const text = bufferUtils.bytesToUtf8(
    decrypt(password, credential.replace(EncryptPrefixImportedCredential, '')),
  );
  return JSON.parse(text) as ICoreImportedCredential;
}

function encryptImportedCredential({
  credential,
  password,
}: {
  credential: ICoreImportedCredential;
  password: string;
}): ICoreImportedCredentialEncryptHex {
  return (
    EncryptPrefixImportedCredential +
    encryptString({
      password,
      data: JSON.stringify(credential),
      dataEncoding: 'utf8',
    })
  );
}

function batchGetKeys(
  curveName: ICurveName,
  hdCredential: ICoreHdCredentialEncryptHex,
  password: string,
  prefix: string,
  relPaths: Array<string>,
  type: 'public' | 'private',
): Array<{
  path: string;
  parentFingerPrint: Buffer;
  extendedKey: IBip32ExtendedKey;
}> {
  const ret: Array<{
    path: string;
    parentFingerPrint: Buffer;
    extendedKey: IBip32ExtendedKey;
  }> = [];
  const cache: Record<
    string,
    {
      fingerPrint: Buffer | undefined;
      parentFingerPrint: Buffer;
      privkey: IBip32ExtendedKey;
    }
  > = {};

  const deriver: IBip32KeyDeriver = getDeriverByCurveName(curveName);
  const { seed } = decryptRevealableSeed({
    rs: hdCredential,
    password,
  });
  const seedBuffer: Buffer = bufferUtils.toBuffer(seed);
  let key: IBip32ExtendedKey = deriver.generateMasterKeyFromSeed(seedBuffer);

  prefix.split('/').forEach((pathComponent) => {
    if (pathComponent === 'm') {
      return;
    }
    const index = pathComponent.endsWith("'")
      ? parseInt(pathComponent.slice(0, -1), 10) + 2 ** 31
      : parseInt(pathComponent, 10);
    key = deriver.CKDPriv(key, index);
  });

  cache[prefix] = {
    fingerPrint: hash160(deriver.N(key).key).slice(0, 4),
    parentFingerPrint: Buffer.from([]),
    privkey: key,
  };

  relPaths.forEach((relPath) => {
    const pathComponents = relPath.split('/');

    let currentPath = prefix;
    let parent = cache[currentPath];
    pathComponents.forEach((pathComponent) => {
      currentPath = `${currentPath}/${pathComponent}`;
      if (typeof cache[currentPath] === 'undefined') {
        const index = pathComponent.endsWith("'")
          ? parseInt(pathComponent.slice(0, -1), 10) + 2 ** 31
          : parseInt(pathComponent, 10);
        const privkey = deriver.CKDPriv(parent.privkey, index);

        if (typeof parent.fingerPrint === 'undefined') {
          parent.fingerPrint = hash160(deriver.N(parent.privkey).key).slice(
            0,
            4,
          );
        }

        cache[currentPath] = {
          fingerPrint: undefined,
          parentFingerPrint: parent.fingerPrint,
          privkey,
        };
      }
      parent = cache[currentPath];
    });

    ret.push({
      path: currentPath,
      parentFingerPrint: cache[currentPath].parentFingerPrint,
      extendedKey:
        type === 'private'
          ? {
              chainCode: cache[currentPath].privkey.chainCode,
              key: encrypt(password, cache[currentPath].privkey.key),
            }
          : deriver.N(cache[currentPath].privkey),
    });
  });

  return ret;
}

export type ISecretPrivateKeyInfo = {
  path: string;
  parentFingerPrint: Buffer;
  extendedKey: IBip32ExtendedKey;
};
function batchGetPrivateKeys(
  curveName: ICurveName,
  hdCredential: ICoreHdCredentialEncryptHex,
  password: string,
  prefix: string,
  relPaths: Array<string>,
): ISecretPrivateKeyInfo[] {
  return batchGetKeys(
    curveName,
    hdCredential,
    password,
    prefix,
    relPaths,
    'private',
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
function batchGetPublicKeys(
  curveName: ICurveName,
  hdCredential: ICoreHdCredentialEncryptHex,
  password: string,
  prefix: string,
  relPaths: Array<string>,
): ISecretPublicKeyInfo[] {
  return batchGetKeys(
    curveName,
    hdCredential,
    password,
    prefix,
    relPaths,
    'public',
  );
}
export type IBatchGetPublicKeysAsyncParams = {
  curveName: ICurveName;
  hdCredential: ICoreHdCredentialEncryptHex;
  password: string;
  prefix: string;
  relPaths: Array<string>;
};
async function batchGetPublicKeysAsync(
  params: IBatchGetPublicKeysAsyncParams,
): Promise<ISecretPublicKeyInfo[]> {
  if (platformEnv.isNative) {
    const keys = await globalThis.$webembedApiProxy.secret.batchGetPublicKeys(
      params,
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
  const { curveName, hdCredential, password, prefix, relPaths } = params;
  return Promise.resolve(
    batchGetPublicKeys(curveName, hdCredential, password, prefix, relPaths),
  );
}

function generateMasterKeyFromSeed(
  curveName: ICurveName,
  hdCredential: IBip39RevealableSeedEncryptHex,
  password: string,
): IBip32ExtendedKey {
  const deriver: IBip32KeyDeriver = getDeriverByCurveName(curveName);
  const { seed } = decryptRevealableSeed({
    rs: hdCredential,
    password,
  });
  const seedBuffer: Buffer = bufferUtils.toBuffer(seed);
  const masterKey: IBip32ExtendedKey =
    deriver.generateMasterKeyFromSeed(seedBuffer);
  return {
    key: encrypt(password, masterKey.key),
    chainCode: masterKey.chainCode,
  };
}

function N(
  curveName: ICurveName,
  encryptedExtPriv: IBip32ExtendedKey,
  password: string,
): IBip32ExtendedKey {
  if (!platformEnv.isJest) {
    ensureSensitiveTextEncoded(password);
  }
  const deriver: IBip32KeyDeriver = getDeriverByCurveName(curveName);
  const extPriv: IBip32ExtendedKey = {
    key: decrypt(password, encryptedExtPriv.key),
    chainCode: encryptedExtPriv.chainCode,
  };
  return deriver.N(extPriv);
}

function CKDPriv(
  curveName: ICurveName,
  encryptedParent: IBip32ExtendedKey,
  index: number,
  password: string,
): IBip32ExtendedKey {
  const deriver: IBip32KeyDeriver = getDeriverByCurveName(curveName);
  const parent: IBip32ExtendedKey = {
    key: decrypt(password, encryptedParent.key),
    chainCode: encryptedParent.chainCode,
  };
  const child: IBip32ExtendedKey = deriver.CKDPriv(parent, index);
  return {
    key: encrypt(password, child.key),
    chainCode: child.chainCode,
  };
}

function CKDPub(
  curveName: ICurveName,
  parent: IBip32ExtendedKey,
  index: number,
): IBip32ExtendedKey {
  return getDeriverByCurveName(curveName).CKDPub(parent, index);
}

function revealableSeedFromMnemonic(
  mnemonic: string,
  password: string,
  passphrase?: string,
): IBip39RevealableSeedEncryptHex {
  const rs: IBip39RevealableSeed = mnemonicToRevealableSeed(
    mnemonic,
    passphrase,
  );
  return encryptRevealableSeed({
    rs,
    password,
  });
}

function mnemonicFromEntropy(
  hdCredential: IBip39RevealableSeedEncryptHex,
  password: string,
): string {
  defaultLogger.account.secretPerf.decryptHdCredential();
  const rs: IBip39RevealableSeed = decryptRevealableSeed({
    password,
    rs: hdCredential,
  });
  defaultLogger.account.secretPerf.decryptHdCredentialDone();

  defaultLogger.account.secretPerf.revealEntropyToMnemonic();
  const r = revealEntropyToMnemonic(
    bufferUtils.toBuffer(rs.entropyWithLangPrefixed),
  );
  defaultLogger.account.secretPerf.revealEntropyToMnemonicDone();

  return r;
}

export type IMnemonicFromEntropyAsyncParams = {
  hdCredential: IBip39RevealableSeedEncryptHex;
  password: string;
};
export function mnemonicFromEntropyAsync(
  params: IMnemonicFromEntropyAsyncParams,
): Promise<string> {
  if (platformEnv.isNative) {
    return globalThis.$webembedApiProxy.secret.mnemonicFromEntropyAsync(params);
  }
  return Promise.resolve(
    mnemonicFromEntropy(params.hdCredential, params.password),
  );
}

export type IMnemonicToSeedAsyncParams = {
  mnemonic: string;
  passphrase?: string;
};
export async function mnemonicToSeedAsync(
  params: IMnemonicToSeedAsyncParams,
): Promise<Buffer> {
  if (platformEnv.isNative) {
    const hex = await globalThis.$webembedApiProxy.secret.mnemonicToSeedAsync(
      params,
    );
    return Buffer.from(hex, 'hex');
  }
  return Promise.resolve(
    mnemonicToSeedSync(params.mnemonic, params.passphrase),
  );
}

export type IGenerateRootFingerprintHexAsyncParams = {
  curveName: ICurveName;
  hdCredential: IBip39RevealableSeedEncryptHex;
  password: string;
};
export async function generateRootFingerprintHexAsync(
  params: IGenerateRootFingerprintHexAsyncParams,
): Promise<string> {
  if (platformEnv.isNative) {
    return globalThis.$webembedApiProxy.secret.generateRootFingerprintHexAsync(
      params,
    );
  }
  const { curveName, hdCredential, password } = params;
  const masterKey = generateMasterKeyFromSeed(
    curveName,
    hdCredential,
    password,
  );
  const publicKey = publicFromPrivate(curveName, masterKey.key, password);
  return hash160(publicKey).slice(0, 4).toString('hex');
}

function revealableSeedFromTonMnemonic(
  mnemonic: string,
  password: string,
): IBip39RevealableSeedEncryptHex {
  const rs: IBip39RevealableSeed = tonMnemonicToRevealableSeed(mnemonic);
  return encryptRevealableSeed({
    rs,
    password,
  });
}

function tonMnemonicFromEntropy(
  hdCredential: IBip39RevealableSeedEncryptHex,
  password: string,
): string {
  defaultLogger.account.secretPerf.decryptHdCredential();
  const rs: IBip39RevealableSeed = decryptRevealableSeed({
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
  batchGetPublicKeysAsync,
  CKDPriv,
  CKDPub,
  compressPublicKey,
  decryptImportedCredential,
  decryptRevealableSeed,
  decryptVerifyString,
  encryptImportedCredential,
  encryptRevealableSeed,
  encryptVerifyString,
  fixV4VerifyStringToV5,
  generateMasterKeyFromSeed,
  mnemonicFromEntropy,
  N,
  publicFromPrivate,
  revealableSeedFromMnemonic,
  revealableSeedFromTonMnemonic,
  tonMnemonicFromEntropy,
  sign,
  uncompressPublicKey,
  verify,
};
