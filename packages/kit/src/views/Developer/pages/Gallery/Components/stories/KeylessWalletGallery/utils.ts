import { cloneDeep, isEqual } from 'lodash';

import type { IKeylessWalletPacks } from '@onekeyhq/shared/src/keylessWallet/keylessWalletTypes';

// Helper function to compare packs with stable fields only
export function isPacksEqual(
  packs1: IKeylessWalletPacks,
  packs2: IKeylessWalletPacks,
): boolean {
  const normalize = (packsToNormalize: IKeylessWalletPacks) => {
    const cloned = cloneDeep(packsToNormalize);
    cloned.authKeyPack.encrypted = 'encrypted';
    cloned.cloudKeyPack.encrypted = 'encrypted';
    cloned.deviceKeyPack.encrypted = 'encrypted';
    return cloned;
  };
  return isEqual(normalize(packs1), normalize(packs2));
}
