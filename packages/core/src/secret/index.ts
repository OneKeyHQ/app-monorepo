import { BaseBip32KeyDeriver, ED25519Bip32KeyDeriver } from './bip32';
import { mnemonicToRevealableSeed, revealEntropy } from './bip39';
import { ed25519, nistp256, secp256k1 } from './curves';
import { decrypt, encrypt } from './encryptors/aes256';
import { hash160 } from './hash';
import ecc from './nobleSecp256k1Wrapper';

import type { Bip32KeyDeriver, ExtendedKey } from './bip32';
import type { RevealableSeed } from './bip39';
import type { BaseCurve } from './curves';
import type { ICurveName } from '../types';

export { ecc };
export * from './bip32';
export * from './bip340';
export * from './bip39';
export * from './curves';
export * from './encryptors/aes256';
export * from './encryptors/rsa';
export * from './hash';

const curves: Map<ICurveName, BaseCurve> = new Map([
  ['secp256k1', secp256k1],
  ['nistp256', nistp256],
  ['ed25519', ed25519],
]);
const derivers: Map<ICurveName, Bip32KeyDeriver> = new Map([
  [
    'secp256k1',
    new BaseBip32KeyDeriver(
      Buffer.from('Bitcoin seed'),
      secp256k1,
    ) as Bip32KeyDeriver,
  ],
  [
    'nistp256',
    new BaseBip32KeyDeriver(
      Buffer.from('Nist256p1 seed'),
      nistp256,
    ) as Bip32KeyDeriver,
  ],
  [
    'ed25519',
    new ED25519Bip32KeyDeriver(
      Buffer.from('ed25519 seed'),
      ed25519,
    ) as Bip32KeyDeriver,
  ],
]);

function getCurveByName(curveName: ICurveName): BaseCurve {
  const curve: BaseCurve | undefined = curves.get(curveName);
  if (curve === undefined) {
    throw Error(`Curve ${curveName} is not supported.`);
  }
  return curve;
}

function getDeriverByCurveName(curveName: ICurveName): Bip32KeyDeriver {
  const deriver: Bip32KeyDeriver | undefined = derivers.get(curveName);
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

function batchGetKeys(
  curveName: ICurveName,
  encryptedSeed: Buffer,
  password: string,
  prefix: string,
  relPaths: Array<string>,
  type: 'public' | 'private',
): Array<{
  path: string;
  parentFingerPrint: Buffer;
  extendedKey: ExtendedKey;
}> {
  const ret: Array<{
    path: string;
    parentFingerPrint: Buffer;
    extendedKey: ExtendedKey;
  }> = [];
  const cache: Record<
    string,
    {
      fingerPrint: Buffer | undefined;
      parentFingerPrint: Buffer;
      privkey: ExtendedKey;
    }
  > = {};

  const deriver: Bip32KeyDeriver = getDeriverByCurveName(curveName);
  const seed: Buffer = decrypt(password, encryptedSeed);
  let key: ExtendedKey = deriver.generateMasterKeyFromSeed(seed);

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
  extendedKey: ExtendedKey;
};
function batchGetPrivateKeys(
  curveName: ICurveName,
  encryptedSeed: Buffer,
  password: string,
  prefix: string,
  relPaths: Array<string>,
): ISecretPrivateKeyInfo[] {
  return batchGetKeys(
    curveName,
    encryptedSeed,
    password,
    prefix,
    relPaths,
    'private',
  );
}

export type ISecretPublicKeyInfo = {
  path: string;
  parentFingerPrint: Buffer;
  extendedKey: ExtendedKey;
};
function batchGetPublicKeys(
  curveName: ICurveName,
  encryptedSeed: Buffer,
  password: string,
  prefix: string,
  relPaths: Array<string>,
): ISecretPublicKeyInfo[] {
  return batchGetKeys(
    curveName,
    encryptedSeed,
    password,
    prefix,
    relPaths,
    'public',
  );
}

function generateMasterKeyFromSeed(
  curveName: ICurveName,
  encryptedSeed: Buffer,
  password: string,
): ExtendedKey {
  const deriver: Bip32KeyDeriver = getDeriverByCurveName(curveName);
  const seed: Buffer = decrypt(password, encryptedSeed);
  const masterKey: ExtendedKey = deriver.generateMasterKeyFromSeed(seed);
  return {
    key: encrypt(password, masterKey.key),
    chainCode: masterKey.chainCode,
  };
}

function N(
  curveName: ICurveName,
  encryptedExtPriv: ExtendedKey,
  password: string,
): ExtendedKey {
  const deriver: Bip32KeyDeriver = getDeriverByCurveName(curveName);
  const extPriv: ExtendedKey = {
    key: decrypt(password, encryptedExtPriv.key),
    chainCode: encryptedExtPriv.chainCode,
  };
  return deriver.N(extPriv);
}

function CKDPriv(
  curveName: ICurveName,
  encryptedParent: ExtendedKey,
  index: number,
  password: string,
): ExtendedKey {
  const deriver: Bip32KeyDeriver = getDeriverByCurveName(curveName);
  const parent: ExtendedKey = {
    key: decrypt(password, encryptedParent.key),
    chainCode: encryptedParent.chainCode,
  };
  const child: ExtendedKey = deriver.CKDPriv(parent, index);
  return {
    key: encrypt(password, child.key),
    chainCode: child.chainCode,
  };
}

function CKDPub(
  curveName: ICurveName,
  parent: ExtendedKey,
  index: number,
): ExtendedKey {
  return getDeriverByCurveName(curveName).CKDPub(parent, index);
}

function revealableSeedFromMnemonic(
  mnemonic: string,
  password: string,
  passphrase?: string,
): RevealableSeed {
  const rs: RevealableSeed = mnemonicToRevealableSeed(mnemonic, passphrase);
  return {
    entropyWithLangPrefixed: encrypt(password, rs.entropyWithLangPrefixed),
    seed: encrypt(password, rs.seed),
  };
}

function mnemonicFromEntropy(
  encryptedEntropy: Buffer,
  password: string,
): string {
  return revealEntropy(decrypt(password, encryptedEntropy));
}

function generateRootFingerprint(
  curveName: ICurveName,
  encryptedSeed: Buffer,
  password: string,
): Buffer {
  const masterKey = generateMasterKeyFromSeed(
    curveName,
    encryptedSeed,
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
  generateMasterKeyFromSeed,
  generateRootFingerprint,
  mnemonicFromEntropy,
  publicFromPrivate,
  revealableSeedFromMnemonic,
  sign,
  uncompressPublicKey,
  verify,
};
