import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import type { IDBDevice, IDBWallet } from '../../dbs/local/types';

function normalizeModel(value: string | undefined): string | undefined {
  const normalized = value?.trim().replace(/\s+/g, ' ').toLowerCase();
  return normalized || undefined;
}

/**
 * Pick the device row to reuse when a wiped Trezor re-inits with the same seed
 * (its device_id changes, so getExistingDevice can't match it).
 *
 * Identity is the XFP, already applied by the caller: same seed = same wallet.
 * vendor/vendorModel only narrow that set, never promote into it, and no
 * BLE/USB identifier takes part. Most recent wallet (walletNo desc) wins.
 */
export function pickThirdPartyRebindDevice({
  walletsWithXfp,
  devices,
  vendor,
  vendorModel,
}: {
  walletsWithXfp: IDBWallet[];
  devices: IDBDevice[];
  vendor: EHardwareVendor | undefined;
  vendorModel: string | undefined;
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
      // Same vendor only — never rebind across vendors on an XFP collision.
      if ((d.vendor ?? EHardwareVendor.onekey) !== normalizedVendor) {
        return false;
      }
      // Only a confident mismatch blocks: stored vendorModel may be an
      // internal code ('t3w1') or a display name, and those aren't comparable.
      const dModel = normalizeModel(d.settings?.vendorModel);
      const qModel = normalizeModel(vendorModel);
      if (dModel && qModel && !dModel.includes(' ') && !qModel.includes(' ')) {
        return dModel === qModel;
      }
      return true;
    })
    .toSorted((a, b) => (b.walletNo ?? 0) - (a.walletNo ?? 0));

  const chosen = matched[0];
  return chosen ? deviceById.get(chosen.associatedDevice as string) : undefined;
}
