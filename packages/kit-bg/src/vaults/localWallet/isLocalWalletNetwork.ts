import { getVaultSettings } from '../settings';

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
    // Generic callers must keep their existing path for networks without
    // vault settings; every local-wallet chain registers settings.
    return false;
  }
}
