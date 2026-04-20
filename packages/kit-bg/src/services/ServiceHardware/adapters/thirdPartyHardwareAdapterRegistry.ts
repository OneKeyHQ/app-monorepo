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
 * Registry of third-party hardware wallet vendor → adapter factory.
 *
 * Single source of truth for which third-party vendors this build supports
 * and how to instantiate each one. ServiceHardware iterates this registry;
 * it does not hard-code vendor names.
 *
 * To support a new vendor (e.g. Trezor):
 *   1. Append an entry `[EHardwareVendor.<name>]: async () => { ... }` below.
 *   2. The factory should dynamic-import its connector loader + SDK adapter
 *      and return a class implementing `IThirdPartyHardwareAdapter`.
 *   3. Nothing else in ServiceHardware needs to change.
 */
export const thirdPartyHardwareAdapterRegistry = {
  [EHardwareVendor.ledger]: async () => {
    const { LedgerAdapter } = await import('./LedgerAdapter');
    const { createLedgerConnector } = await import(
      '@onekeyhq/shared/src/hardware/connector-loader/ledger'
    );
    const { LedgerAdapter: HwkLedgerAdapter } = await import(
      '@onekeyfe/hwk-ledger-adapter'
    );
    const connector = await createLedgerConnector();
    const hw = new HwkLedgerAdapter(connector);
    return new LedgerAdapter(hw, connector);
  },
} satisfies Partial<
  Record<EHardwareVendor, IThirdPartyHardwareAdapterFactory>
>;

/**
 * Union of vendors that have an adapter registered in this build.
 * Derived from the registry keys — adding a vendor above automatically
 * widens this type; removing a vendor narrows it.
 */
export type IThirdPartyVendor =
  keyof typeof thirdPartyHardwareAdapterRegistry;
