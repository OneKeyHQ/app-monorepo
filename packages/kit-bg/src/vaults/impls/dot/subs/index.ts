import VaultDotSubAssetHub from './VaultDotSubAssetHub';
import VaultDotSubBase from './VaultDotSubBase';
import VaultDotSubCommon from './VaultDotSubCommon';
import VaultDotSubHydration from './VaultDotSubHydration';
import VaultDotSubJoyStream from './VaultDotSubJoyStream';

import type VaultDot from '../Vault';

type ISubConstructor = new (vault: VaultDot) => VaultDotSubBase;

const SUB_VAULTS: ISubConstructor[] = [
  VaultDotSubAssetHub,
  VaultDotSubJoyStream,
  VaultDotSubHydration,
];

export function createVaultDotSub(
  vault: VaultDot,
  networkId: string,
  chainId: string,
): VaultDotSubBase {
  for (const SubVault of SUB_VAULTS) {
    const instance = new SubVault(vault);
    if (instance.supportsNetwork(networkId, chainId)) {
      return instance;
    }
  }

  return new VaultDotSubCommon(vault);
}

export { VaultDotSubBase, VaultDotSubCommon };
