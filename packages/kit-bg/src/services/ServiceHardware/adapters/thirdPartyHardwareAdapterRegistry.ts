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
    const { createLedgerConnector } =
      await import('@onekeyhq/shared/src/hardware/connector-loader/ledger');
    const { LedgerAdapter: HwkLedgerAdapter } =
      await import('@onekeyfe/hwk-ledger-adapter');
    const connector = await createLedgerConnector();
    const hw = new HwkLedgerAdapter(connector);
    return new LedgerAdapter(hw, connector);
  },
} satisfies Partial<Record<EHardwareVendor, IThirdPartyHardwareAdapterFactory>>;

/**
 * Union of vendors that have an adapter registered in this build.
 * Derived from the registry keys — adding a vendor above automatically
 * widens this type; removing a vendor narrows it.
 */
export type IThirdPartyVendor = keyof typeof thirdPartyHardwareAdapterRegistry;
