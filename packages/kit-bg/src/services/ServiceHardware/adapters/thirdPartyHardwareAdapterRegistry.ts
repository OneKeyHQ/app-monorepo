import { EThirdPartyDevicePermissionDeniedReason } from '@onekeyhq/shared/src/errors/errors/thirdPartyHardwareErrors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  checkBLEPermissions,
  checkBLEState,
} from '@onekeyhq/shared/src/hardware/blePermissions';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
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
    defaultLogger.hardware.sdkLog.log(
      '[3rdPartyHW][Registry] ledger factory start',
    );
    const { LedgerAdapter } = await import('./LedgerAdapter');
    // webpack resolves this to the platform-specific variant:
    //   - ext Service Worker (MV3) → `ledger.ext-bg-v3.ts` (bridges to offscreen)
    //   - desktop / native / web   → `ledger.desktop.ts` / `.native.ts` / `.ts`
    const { createLedgerConnector } =
      await import('@onekeyhq/shared/src/hardware/connector-loader/ledger');
    const { LedgerAdapter: HwkLedgerAdapter, onSdkEvent } =
      await import('@onekeyfe/hwk-ledger-adapter');
    const { UI_REQUEST, UI_RESPONSE } =
      await import('@onekeyfe/hwk-adapter-core');
    // SW-side subscriber. Offscreen runtime has its own bus singleton and
    // forwards into this same logger via IPC.
    onSdkEvent((event) => {
      if (event.type === 'log') {
        defaultLogger.hardware.sdkLog.log(`[hwk] ${event.message}`);
      }
    });
    const connector = await createLedgerConnector();
    defaultLogger.hardware.sdkLog.log(
      '[3rdPartyHW][Registry] ledger connector created',
    );
    // Auto-install a missing Ledger app in-flight: on AppNotInstalled the SDK
    // prompts (REQUEST_INSTALL_APP), installs with progress, then retries.
    // A specific call can opt out via commonParams.autoInstallApp = false.
    const hw = new HwkLedgerAdapter(connector, { autoInstallApp: true });
    // Only native mobile (iOS/Android) has an app-level BLE permission.
    // Desktop/web/extension handle device permission at the OS/browser layer
    // (WebHID/WebUSB prompts, node-hid, system Bluetooth) — from this app's
    // perspective there's nothing to check, so grant immediately.
    hw.on(UI_REQUEST.REQUEST_DEVICE_PERMISSION, async () => {
      defaultLogger.hardware.sdkLog.log(
        '[3rdPartyHW][Registry] REQUEST_DEVICE_PERMISSION',
      );
      let granted = true;
      let reason: EThirdPartyDevicePermissionDeniedReason | undefined;
      if (platformEnv.isNative) {
        const isPermissionGranted = !!(await checkBLEPermissions());
        if (!isPermissionGranted) {
          granted = false;
          reason = EThirdPartyDevicePermissionDeniedReason.permissionDenied;
        } else {
          const isBluetoothOn = await checkBLEState();
          if (!isBluetoothOn) {
            granted = false;
            reason = EThirdPartyDevicePermissionDeniedReason.bluetoothTurnedOff;
          }
          defaultLogger.hardware.sdkLog.log(
            `[3rdPartyHW][Registry] BLE state enabled=${String(isBluetoothOn)}`,
          );
        }
      }
      defaultLogger.hardware.sdkLog.log(
        `[3rdPartyHW][Registry] BLE permission granted=${String(granted)}`,
      );
      if (!granted && reason) {
        appEventBus.emit(
          EAppEventBusNames.ShowThirdPartyHardwarePermissionDialog,
          {
            vendor: EHardwareVendor.ledger,
            reason,
          },
        );
      }
      const permissionPayload = reason ? { granted, reason } : { granted };
      hw.uiResponse({
        type: UI_RESPONSE.RECEIVE_DEVICE_PERMISSION,
        payload: permissionPayload,
      });
    });
    defaultLogger.hardware.sdkLog.log(
      '[3rdPartyHW][Registry] ledger adapter ready',
    );
    return new LedgerAdapter(hw);
  },
} satisfies Partial<Record<EHardwareVendor, IThirdPartyHardwareAdapterFactory>>;

/**
 * Union of vendors that have an adapter registered in this build.
 * Derived from the registry keys — adding a vendor above automatically
 * widens this type; removing a vendor narrows it.
 */
export type IThirdPartyVendor = keyof typeof thirdPartyHardwareAdapterRegistry;
