import { HardwareErrorCode as ThirdPartyHwErrorCode } from '@onekeyfe/hwk-adapter-core/errors';

import { convertThirdPartyDeviceError } from '@onekeyhq/shared/src/errors/utils/thirdPartyDeviceErrorUtils';

import localDb from '../../dbs/local/localDb';

import type { IHwAllNetworkPrepareAccountsItem } from '../types';

/**
 * Keystone exports are unsigned, so the account key behind each address is pinned per
 * `network:accountPath` as public key plus chain code (the xpub string also carries encoding
 * fields that may differ between exports). Items sharing an entry must agree; `conflicting`
 * lists those that do not.
 */
export function collectKeystoneAccountKeys(
  items: IHwAllNetworkPrepareAccountsItem[],
): { keys: Record<string, string>; conflicting: string[] } {
  const keys: Record<string, string> = {};
  const conflicting = new Set<string>();
  for (const item of items) {
    const accountKey = item.success ? item.payload?.accountKey : undefined;
    if (accountKey?.publicKey) {
      const key = `${accountKey.publicKey}:${accountKey.chainCode ?? ''}`;
      const entry = `${item.network}:${accountKey.path}`;
      if (keys[entry] !== undefined && keys[entry] !== key) {
        conflicting.add(entry);
      }
      keys[entry] = keys[entry] ?? key;
    }
  }
  return { keys, conflicting: [...conflicting] };
}

/**
 * Refuse Keystone results derived from an account key other than the one first seen for it, and
 * pin the keys seen for the first time. Must run before the results replace stored accounts.
 * Without `dbDeviceId` only the export's own consistency is checked.
 */
export async function pinKeystoneAccountKeys({
  dbDeviceId,
  items,
  vendorName,
}: {
  dbDeviceId: string | undefined;
  items: IHwAllNetworkPrepareAccountsItem[];
  vendorName: string;
}): Promise<void> {
  const { keys, conflicting } = collectKeystoneAccountKeys(items);
  let mismatched = conflicting;
  if (dbDeviceId && !mismatched.length && Object.keys(keys).length) {
    mismatched = await localDb.pinDeviceKeystoneAccountKeys({
      dbDeviceId,
      keys,
    });
  }
  if (mismatched.length) {
    throw convertThirdPartyDeviceError(
      {
        code: ThirdPartyHwErrorCode.DeviceMismatch,
        error: `Keystone returned a different account key than before for ${mismatched.join(
          ', ',
        )}`,
      },
      { vendor: vendorName },
    );
  }
}
