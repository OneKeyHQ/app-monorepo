import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import type { IKeyringMap } from './VaultBase';

// Uses the same map the keyring factory resolves, so it cannot drift from
// what actually works.
export function keyringMapSupportsAccount({
  keyringMap,
  accountId,
}: {
  keyringMap: IKeyringMap;
  accountId: string;
}): boolean {
  if (accountUtils.isHdAccount({ accountId })) {
    return Boolean(keyringMap.hd);
  }
  if (accountUtils.isQrAccount({ accountId })) {
    return Boolean(keyringMap.qr);
  }
  if (accountUtils.isHwAccount({ accountId })) {
    // The vendor is only known from the device row, not available here.
    return Boolean(keyringMap.hw || keyringMap.hwLedger || keyringMap.hwTrezor);
  }
  if (accountUtils.isImportedAccount({ accountId })) {
    return Boolean(keyringMap.imported);
  }
  if (accountUtils.isWatchingAccount({ accountId })) {
    return Boolean(keyringMap.watching);
  }
  if (accountUtils.isExternalAccount({ accountId })) {
    return Boolean(keyringMap.external);
  }
  return false;
}
