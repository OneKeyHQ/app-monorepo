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
 * (vendorModel) match, so the old (possibly deprecated) wallet is reused.
 *
 * Match is XFP + vendor + vendorModel ONLY — never connectId (it differs
 * across USB/BLE transports). The incoming vendorModel is the SDK's internal
 * model code (e.g. 'T3W1' for a Trezor Safe 7) — NOT `IDBDevice.deviceType`,
 * which is an hd-core classification that only understands OneKey's own model
 * encoding and always resolves to 'unknown' for a third-party device, making
 * a deviceType guard a no-op.
 *
 * The model guard only blocks a CONFIDENT mismatch. Stored
 * `settings.vendorModel` is written by several paths and may hold either the
 * internal code ('T3W1') or a display name ('Trezor Safe 7' — see
 * isTrezorBleSupportedModel, which accepts both). A display name is not
 * comparable against an internal code, so the comparison runs only when both
 * sides are code-shaped (single token) — anything else means "unknown, not
 * disproven" and must not veto a match XFP + vendor already carry.
 *
 * Among matches the most recent wallet (walletNo desc) wins, so an
 * already-live duplicate is preferred over a stale deprecated one.
 *
 * Pure: no DB access, unit-testable in isolation.
 */
function normalizeModel(value: string | undefined): string | undefined {
  const normalized = value?.trim().replace(/\s+/g, ' ').toLowerCase();
  return normalized || undefined;
}

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
      // Block only a confident model mismatch: both sides normalized and
      // code-shaped (no spaces). A stored display name is not comparable
      // against the incoming internal code and must not block.
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
