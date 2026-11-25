import type { IEncodedTx } from '@onekeyhq/core/src/types';
import { IMPL_STARKNET } from '@onekeyhq/shared/src/engine/engineConsts';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

import { getVaultSettings } from '../settings';

// Starknet has public and private transactions on the same network.
export function isStarknetPrivateTransaction(
  networkId: string,
  encodedTx: IEncodedTx,
) {
  return (
    typeof encodedTx === 'object' &&
    encodedTx !== null &&
    'privacy' in encodedTx &&
    !!encodedTx.privacy &&
    networkUtils.getNetworkImpl({ networkId }) === IMPL_STARKNET
  );
}

// Privacy (local-wallet) chains review their own transactions and own
// recipient validation; generic code asks this instead of naming a chain.
export async function isLocalWalletNetwork({
  networkId,
}: {
  networkId: string;
}): Promise<boolean> {
  try {
    return !!(await getVaultSettings({ networkId })).localWallet;
  } catch {
    return false;
  }
}

// Such a chain's addresses never reach address-scoped backend endpoints.
export async function isAddressWithheldFromBackend({
  networkId,
}: {
  networkId: string;
}): Promise<boolean> {
  try {
    return (
      (await getVaultSettings({ networkId })).localWallet
        ?.withholdAddressFromBackend === true
    );
  } catch {
    return false;
  }
}

// False only when the chain declares an address shape the input cannot have.
export async function mayBeLocalWalletAddress({
  networkId,
  address,
}: {
  networkId: string;
  address: string;
}): Promise<boolean> {
  try {
    const pattern = (await getVaultSettings({ networkId })).localWallet
      ?.addressShapePattern;
    return !pattern || new RegExp(pattern).test(address);
  } catch {
    return true;
  }
}
