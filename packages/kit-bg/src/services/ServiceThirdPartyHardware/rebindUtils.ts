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
 * IDENTITY COMES FROM THE XFP, and the caller has already applied it: the
 * `walletsWithXfp` it passes in are the wallets whose master fingerprint —
 * derived cryptographically from the seed — equals the connected device's.
 * Two devices sharing an XFP hold the same seed and ARE the same wallet, so
 * this is the strong identifier, not a heuristic. No BLE/USB identifier takes
 * part: connectId differs across transports and a Trezor's BLE address
 * rotates, so neither can identify anything.
 *
 * vendor and vendorModel are narrowing filters ON TOP of that, guarding
 * against an XFP collision across vendors or hardware generations. They can
 * only ever REJECT a candidate the XFP already accepted; they never promote
 * one.
 *
 * The model filter deliberately blocks a CONFIDENT mismatch only. Incoming
 * vendorModel is the SDK's internal code ('T3W1'), but stored
 * `settings.vendorModel` is written by several paths and may hold that code
 * OR a display name ('Trezor Safe 7' — isTrezorBleSupportedModel accepts
 * both). A display name cannot be compared against an internal code, so the
 * comparison runs only when both sides are code-shaped (single token).
 * Anything else means "unknown, not disproven" and must not veto the XFP
 * match — a false rejection here creates the duplicate wallet this whole
 * function exists to prevent. (`IDBDevice.deviceType` is useless for this:
 * it is an hd-core classification that always resolves to 'unknown' for a
 * third-party device.)
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

  // Every entry here already matched on XFP (same seed = same wallet). What
  // follows only narrows that set; it can reject, never promote.
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
