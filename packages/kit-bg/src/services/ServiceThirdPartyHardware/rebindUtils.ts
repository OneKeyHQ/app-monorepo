import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import type { IDBDevice, IDBWallet } from '../../dbs/local/types';

/**
 * Third-party (Trezor) same-mnemonic re-bind selection.
 *
 * A Trezor device_id changes on a full wipe and Trezor has no stable uuid, so
 * the seed-derived device-reuse tier in getExistingDevice is unreachable and a
 * same-mnemonic re-init would create a duplicate wallet. This picks the device
 * row of the existing STANDARD hardware wallet whose seed (XFP) and model
 * (deviceType) match, so the old (possibly deprecated) wallet is reused.
 *
 * Match is XFP + vendor + deviceType ONLY — never connectId (it differs across
 * USB/BLE transports). Among matches the most recent wallet (walletNo desc)
 * wins, so an already-live duplicate is preferred over a stale deprecated one.
 *
 * Pure: no DB access, unit-testable in isolation.
 */
export function pickThirdPartyRebindDevice({
  walletsWithXfp,
  devices,
  vendor,
  deviceType,
}: {
  walletsWithXfp: IDBWallet[];
  devices: IDBDevice[];
  vendor: EHardwareVendor | undefined;
  deviceType: IDBDevice['deviceType'];
}): IDBDevice | undefined {
  const normalizedVendor = vendor ?? EHardwareVendor.onekey;
  const deviceById = new Map(devices.map((d) => [d.id, d]));

  const matched = walletsWithXfp
    .filter((w) => {
      if (
        !accountUtils.isHwWallet({ walletId: w.id }) ||
        accountUtils.isHwHiddenWallet({ wallet: w }) ||
        !w.associatedDevice
      ) {
        return false;
      }
      const d = deviceById.get(w.associatedDevice);
      if (!d) {
        return false;
      }
      // Same vendor and same model only — never rebind across vendors on an
      // XFP collision, nor across device models (e.g. Safe 5 vs Safe 3).
      return (
        (d.vendor ?? EHardwareVendor.onekey) === normalizedVendor &&
        d.deviceType === deviceType
      );
    })
    .toSorted((a, b) => (b.walletNo ?? 0) - (a.walletNo ?? 0));

  const chosen = matched[0];
  return chosen ? deviceById.get(chosen.associatedDevice as string) : undefined;
}
