import platformEnv from '@onekeyhq/shared/src/platformEnv';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import { BaseBip32KeyDeriver, ED25519Bip32KeyDeriver } from './bip32';
import { mnemonicToRevealableSeed, revealEntropyToMnemonic } from './bip39';
import { ed25519, nistp256, secp256k1 } from './curves';
import {
  decrypt,
  encrypt,
  encryptString,
  ensureSensitiveTextEncoded,
} from './encryptors/aes256';
import { hash160 } from './hash';
import ecc from './nobleSecp256k1Wrapper';

import type { IBip32ExtendedKey, IBip32KeyDeriver } from './bip32';
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
export { ecc };

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

function decryptRevealableSeed({
  rs,
  password,
}: {
  rs: IBip39RevealableSeedEncryptHex;
  password: string;
}): IBip39RevealableSeed {
  const rsJsonStr = bufferUtils.bytesToUtf8(decrypt(password, rs));
  return JSON.parse(rsJsonStr) as IBip39RevealableSeed;
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
      ? parseInt(pathComponent.slice(0, -1)) + 2 ** 31
      : parseInt(pathComponent);
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
          ? parseInt(pathComponent.slice(0, -1)) + 2 ** 31
          : parseInt(pathComponent);
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

function encryptRevealableSeed({
  rs,
  password,
}: {
  rs: IBip39RevealableSeed;
  password: string;
}): IBip39RevealableSeedEncryptHex {
  return bufferUtils.bytesToHex(
    encryptString({
      password,
      data: JSON.stringify({
        entropyWithLangPrefixed: rs.entropyWithLangPrefixed,
        seed: rs.seed,
      }),
      dataEncoding: 'utf8',
    }),
  );
}

function decryptImportedCredential({
  credential,
  password,
}: {
  credential: ICoreImportedCredentialEncryptHex;
  password: string;
}): ICoreImportedCredential {
  const text = bufferUtils.bytesToUtf8(decrypt(password, credential));
  return JSON.parse(text) as ICoreImportedCredential;
}

function encryptImportedCredential({
  credential,
  password,
}: {
  credential: ICoreImportedCredential;
  password: string;
}): ICoreImportedCredentialEncryptHex {
  return encryptString({
    password,
    data: JSON.stringify(credential),
    dataEncoding: 'utf8',
  });
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
  const rs: IBip39RevealableSeed = JSON.parse(
    bufferUtils.bytesToUtf8(decrypt(password, hdCredential)),
  );
  return revealEntropyToMnemonic(
    bufferUtils.toBuffer(rs.entropyWithLangPrefixed),
  );
}

function generateRootFingerprint(
  curveName: ICurveName,
  hdCredential: IBip39RevealableSeedEncryptHex,
  password: string,
): Buffer {
  const masterKey = generateMasterKeyFromSeed(
    curveName,
    hdCredential,
    password,
  );
  const publicKey = publicFromPrivate(curveName, masterKey.key, password);
  return hash160(publicKey).slice(0, 4);
}

export {
  CKDPriv,
  CKDPub,
  N,
  batchGetPrivateKeys,
  batchGetPublicKeys,
  compressPublicKey,
  decryptImportedCredential,
  decryptRevealableSeed,
  encryptImportedCredential,
  encryptRevealableSeed,
  generateMasterKeyFromSeed,
  generateRootFingerprint,
  mnemonicFromEntropy,
  publicFromPrivate,
  revealableSeedFromMnemonic,
  sign,
  uncompressPublicKey,
  verify,
};
