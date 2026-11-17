import { ed25519 } from '@noble/curves/ed25519';

import { baseAddressFromXpub, stakingAddressFromXpub } from './addresses';

export type IAdaPublicAccountAddressesParams = {
  xpub: string;
  paths: string[];
  networkId: 0 | 1;
};

// Runs only in the existing ADA SDK host (web, offscreen, or WebEmbed).
// Never import this module into the native/extension background graph.
export async function derivePublicAccountAddresses({
  xpub,
  paths,
  networkId,
}: IAdaPublicAccountAddressesParams): Promise<
  Record<string, string> | undefined
> {
  if (
    !/^[0-9a-fA-F]{128}$/.test(xpub) ||
    !Array.isArray(paths) ||
    paths.length > 65 ||
    ![0, 1].includes(networkId) ||
    paths.some((path) => {
      if (!/^[012]\/\d{1,10}$/.test(path)) return true;
      const [role, index] = path.split('/').map(Number);
      return index >= 2 ** 31 || (role === 2 && index !== 0);
    })
  ) {
    return undefined;
  }
  const root = Buffer.from(xpub, 'hex');
  try {
    ed25519.ExtendedPoint.fromHex(root.subarray(0, 32)).assertValidity();
  } catch {
    return undefined;
  }
  const { Bip32PublicKey } =
    await import('@emurgo/cardano-serialization-lib-asmjs');
  const accountKey = Bip32PublicKey.from_bytes(root);
  try {
    const child = (role: number, index: number): Buffer => {
      const branch = accountKey.derive(role);
      try {
        const leaf = branch.derive(index);
        try {
          return Buffer.from(leaf.as_bytes());
        } finally {
          leaf.free();
        }
      } finally {
        branch.free();
      }
    };
    const stake = child(2, 0);
    const result: Record<string, string> = {};
    for (const path of new Set(paths)) {
      const [role, index] = path.split('/').map(Number);
      result[path] =
        role === 2
          ? stakingAddressFromXpub(stake, networkId)
          : baseAddressFromXpub(child(role, index), stake, networkId);
    }
    return result;
  } finally {
    accountKey.free();
  }
}
