import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import type { IKeyringMap } from './VaultBase';

/**
 * Whether a chain has a keyring for the wallet that owns `accountId`.
 *
 * The keyring factory resolves against this same map, so asking it is the
 * only answer that cannot drift from what actually works. Inferring from the
 * account id instead is what let Monero offer a scan toggle to hardware
 * wallets it has no keyring for.
 */
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
    // Which vendor this is can only be read from the device row, which is not
    // available here. A chain with none of the three cannot serve a hardware
    // wallet of any vendor, which is the case this exists for.
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
