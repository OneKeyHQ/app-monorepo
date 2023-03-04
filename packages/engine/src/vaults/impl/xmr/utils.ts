import { fromSeed } from 'bip32';
import sha3 from 'js-sha3';

import { COINTYPE_XMR as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';

import type { MoneroModule } from './sdk/moneroCore/monoreModule';
import type { BIP32Interface } from 'bip32';

const HARDEN_PATH_PREFIX = `m/44'/${COIN_TYPE as string}'/0'/0`;

export function calcBip32ExtendedKey(
  path: string,
  bip32RootKey: BIP32Interface,
) {
  // Check there's a root key to derive from
  if (!bip32RootKey) {
    return bip32RootKey;
  }
  let extendedKey = bip32RootKey;
  // Derive the key from the path
  const pathBits = path.split('/');
  for (let i = 0; i < pathBits.length; i += 1) {
    const bit = pathBits[i];
    const index = parseInt(bit);
    if (Number.isNaN(index)) {
      // eslint-disable-next-line no-continue
      continue;
    }
    const hardened = bit[bit.length - 1] === "'";
    const isPriv = !extendedKey.isNeutered();
    const invalidDerivationPath = hardened && !isPriv;
    if (invalidDerivationPath) {
      return null;
    }
    if (hardened) {
      extendedKey = extendedKey.deriveHardened(index);
    } else {
      extendedKey = extendedKey.derive(index);
    }
  }
  return extendedKey;
}

export function getRawPrivateKeyFromSeed(seed: Buffer, pathPrefix: string) {
  const rootKey = fromSeed(seed, {
    messagePrefix: 'x18XMR Signed Message:\n',
    bip32: {
      public: 0x0488b21e,
      private: 0x0488ade4,
    },
    pubKeyHash: 0x7f,
    scriptHash: 0xc4,
    wif: 0x3f,
  });

  const extendedKey = calcBip32ExtendedKey(pathPrefix, rootKey);

  if (!extendedKey) {
    return null;
  }
  const key = extendedKey.derive(0);
  const rawPrivateKey = key.privateKey;

  return rawPrivateKey;
}

export function getKeyPairFromRawPrivatekey({
  xmrModule,
  rawPrivateKey,
  index = 0,
}: {
  xmrModule: MoneroModule;
  rawPrivateKey: Buffer;
  index?: number;
}) {
  const rawSecretSpendKey = new Uint8Array(
    sha3.keccak_256.update(rawPrivateKey).arrayBuffer(),
  );
  let privateSpendKey = xmrModule.scReduce32(rawSecretSpendKey);
  const privateViewKey = xmrModule.hashToScalar(privateSpendKey);

  let publicSpendKey: Uint8Array | null;
  let publicViewKey: Uint8Array | null;

  if (index === 0) {
    publicSpendKey = xmrModule.privateKeyToPublicKey(privateSpendKey);
    publicViewKey = xmrModule.privateKeyToPublicKey(privateViewKey);
  } else {
    const m = xmrModule.getSubaddressPrivateKey(privateViewKey, index, 0);
    privateSpendKey = xmrModule.scAdd(m, privateSpendKey);
    publicSpendKey = xmrModule.privateKeyToPublicKey(privateSpendKey);
    publicViewKey = xmrModule.scalarmultKey(
      publicSpendKey || new Uint8Array(),
      privateViewKey,
    );
  }

  return {
    privateSpendKey,
    privateViewKey,
    publicSpendKey,
    publicViewKey,
  };
}
