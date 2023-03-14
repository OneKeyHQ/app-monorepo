import { fromSeed } from 'bip32';

import { IDecodedTxStatus } from '../../types';

import type { IOnChainHistoryTx } from './types';
import type { BIP32Interface } from 'bip32';

const TX_MIN_CONFIRMS = 10;

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

export function getDecodedTxStatus(
  tx: IOnChainHistoryTx,
  blockchainHeight: number,
) {
  if (tx.mempool) {
    return IDecodedTxStatus.Pending;
  }
  if (tx.height === null || tx.height === undefined) {
    return IDecodedTxStatus.Pending;
  }

  return blockchainHeight - tx.height >= TX_MIN_CONFIRMS
    ? IDecodedTxStatus.Confirmed
    : IDecodedTxStatus.Pending;
}
