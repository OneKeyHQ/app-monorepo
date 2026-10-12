import type { IHwAllNetworkPrepareAccountsItem } from '../types';

/**
 * Keystone exports are unsigned, so the account key behind each address is pinned per
 * `network:accountPath`. Items sharing an entry must agree; `conflicting` lists those that do not.
 */
export function collectKeystoneAccountKeys(
  items: IHwAllNetworkPrepareAccountsItem[],
): { keys: Record<string, string>; conflicting: string[] } {
  const keys: Record<string, string> = {};
  const conflicting = new Set<string>();
  for (const item of items) {
    const accountKey = item.success ? item.payload?.accountKey : undefined;
    const key = accountKey?.xpub ?? accountKey?.publicKey;
    if (accountKey && key) {
      const entry = `${item.network}:${accountKey.path}`;
      if (keys[entry] !== undefined && keys[entry] !== key) {
        conflicting.add(entry);
      }
      keys[entry] = keys[entry] ?? key;
    }
  }
  return { keys, conflicting: [...conflicting] };
}
