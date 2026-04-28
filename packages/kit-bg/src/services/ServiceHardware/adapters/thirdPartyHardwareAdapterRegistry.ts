import { checkBLEPermissions } from '@onekeyhq/shared/src/hardware/blePermissions';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import type { IThirdPartyHardwareAdapter } from './types';

/**
 * Factory that lazily constructs an IThirdPartyHardwareAdapter for one vendor.
 *
 * Dynamic imports inside each factory keep per-vendor dependencies
 * (connector loaders, SDK adapters) out of the eager load graph — they're
 * only pulled in when the user actually touches that vendor's device.
 */
export type IThirdPartyHardwareAdapterFactory =
  () => Promise<IThirdPartyHardwareAdapter>;

/**
 * Registry of third-party vendor → adapter factory. Single source of truth;
 * ServiceHardware iterates this, never hard-codes vendor names. Add a vendor
 * by appending an entry with a dynamic-import factory.
 */
export const thirdPartyHardwareAdapterRegistry = {
  [EHardwareVendor.ledger]: async () => {
    const { LedgerAdapter } = await import('./LedgerAdapter');
    // webpack resolves this to the platform-specific variant:
    //   - ext Service Worker (MV3) → `ledger.ext-bg-v3.ts` (bridges to offscreen)
    //   - desktop / native / web   → `ledger.desktop.ts` / `.native.ts` / `.ts`
    const { createLedgerConnector } =
      await import('@onekeyhq/shared/src/hardware/connector-loader/ledger');
    const { LedgerAdapter: HwkLedgerAdapter, setDebugEnabled } =
      await import('@onekeyfe/hwk-ledger-adapter');
    const { UI_REQUEST, UI_RESPONSE } =
      await import('@onekeyfe/hwk-adapter-core');
    // DEV: surface real DMK errors that SDK maps to code=0 Unknown.
    setDebugEnabled(platformEnv.isDev ?? false);
    const connector = await createLedgerConnector();
    const hw = new HwkLedgerAdapter(connector);
    // Only native mobile (iOS/Android) has an app-level BLE permission.
    // Desktop/web/extension handle device permission at the OS/browser layer
    // (WebHID/WebUSB prompts, node-hid, system Bluetooth) — from this app's
    // perspective there's nothing to check, so grant immediately.
    hw.on(UI_REQUEST.REQUEST_DEVICE_PERMISSION, async () => {
      const granted = platformEnv.isNative
        ? !!(await checkBLEPermissions())
        : true;
      hw.uiResponse({
        type: UI_RESPONSE.RECEIVE_DEVICE_PERMISSION,
        payload: { granted },
      });
    });
    return new LedgerAdapter(hw, connector);
  },
} satisfies Partial<Record<EHardwareVendor, IThirdPartyHardwareAdapterFactory>>;

/**
 * Union of vendors that have an adapter registered in this build.
 * Derived from the registry keys — adding a vendor above automatically
 * widens this type; removing a vendor narrows it.
 */
export type IThirdPartyVendor = keyof typeof thirdPartyHardwareAdapterRegistry;
