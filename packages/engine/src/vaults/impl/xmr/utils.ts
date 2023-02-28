import type { BIP32Interface } from 'bip32';

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
