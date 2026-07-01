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
import type {
  IHardwareBridge,
  UiResponseEvent,
} from '@onekeyfe/hwk-adapter-core';

type IHwkSdkLogEvent = {
  type: string;
  message?: string;
};

type ITrezorAdapterModule = typeof import('@onekeyfe/hwk-trezor-adapter') & {
  onSdkEvent?: (listener: (event: IHwkSdkLogEvent) => void) => () => void;
};

let unsubscribeTrezorSdkEvent: (() => void) | undefined;

export function resetTrezorSdkLogSubscriptionForTesting(): void {
  unsubscribeTrezorSdkEvent?.();
  unsubscribeTrezorSdkEvent = undefined;
}

function ensureTrezorSdkLogSubscription(
  trezorAdapterModule: ITrezorAdapterModule,
): (() => void) | undefined {
  if (!unsubscribeTrezorSdkEvent) {
    unsubscribeTrezorSdkEvent = trezorAdapterModule.onSdkEvent?.((event) => {
      if (event.type === 'log') {
        defaultLogger.hardware.sdkLog.log(`[hwk] ${event.message ?? ''}`);
      }
    });
  }
  return () => {
    unsubscribeTrezorSdkEvent?.();
    unsubscribeTrezorSdkEvent = undefined;
  };
}

function isTrezorThpCredential(
  value: unknown,
): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false;
  const credential = value as {
    credential?: unknown;
    host_static_key?: unknown;
    trezor_static_public_key?: unknown;
  };
  return (
    typeof credential.credential === 'string' &&
    typeof credential.host_static_key === 'string' &&
    typeof credential.trezor_static_public_key === 'string'
  );
}

type IDevicePermissionAwareAdapter = {
  on: (event: string, listener: () => Promise<void>) => void;
  uiResponse: (response: UiResponseEvent) => void;
};

/**
 * Wire the host's BLE permission gate for one vendor's adapter. The SDK emits
 * REQUEST_DEVICE_PERMISSION before scanning/connecting; on native we check the
 * app-level BLE permission and Bluetooth power state, show the matching dialog,
 * then reply. Desktop/web/ext have no app-level BLE permission (the OS/browser
 * handles WebHID/WebUSB/system Bluetooth), so we grant immediately.
 *
 * Without this handler the SDK's gate no-ops (listenerCount === 0) and a
 * missing-permission scan surfaces as a raw BleError toast instead of the
 * permission dialog — so every BLE-capable vendor must register it.
 */
async function registerThirdPartyDevicePermissionHandler(
  hw: IDevicePermissionAwareAdapter,
  vendor: EHardwareVendor,
): Promise<void> {
  const { UI_REQUEST, UI_RESPONSE } =
    await import('@onekeyfe/hwk-adapter-core');
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
        { vendor, reason },
      );
    }
    const permissionPayload = reason ? { granted, reason } : { granted };
    hw.uiResponse({
      type: UI_RESPONSE.RECEIVE_DEVICE_PERMISSION,
      payload: permissionPayload,
    });
  });
}

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
  [EHardwareVendor.trezor]: async () => {
    defaultLogger.hardware.sdkLog.log(
      '[3rdPartyHW][Registry] trezor factory start',
    );
    const { TrezorAdapter } = await import('./TrezorAdapter');
    // webpack resolves this to the platform-specific variant:
    //   - ext Service Worker (MV3) → `trezor.ext-bg-v3.ts` (bridges to offscreen)
    //   - desktop / native / web   → `trezor.desktop.ts` / `.native.ts` / `.ts`
    const { createTrezorConnector } =
      await import('@onekeyhq/shared/src/hardware/connector-loader/trezor');
    const trezorAdapterModule =
      (await import('@onekeyfe/hwk-trezor-adapter')) as ITrezorAdapterModule;
    const { TrezorAdapter: HwkTrezorAdapter } = trezorAdapterModule;
    const disposeSdkEvents =
      ensureTrezorSdkLogSubscription(trezorAdapterModule);
    // Temporary transport switch for desktop. Other platform loaders take no
    // arguments, so they ignore the hint. Set in DevTools:
    //   localStorage.setItem('debug.trezor.transport', 'ble')   // switch to BLE
    //   localStorage.removeItem('debug.trezor.transport')       // back to USB
    // Once the proper UI transport picker lands this hack goes away.
    let transportHint: 'ble' | undefined;
    try {
      if (
        typeof globalThis !== 'undefined' &&
        (globalThis as { localStorage?: Storage }).localStorage?.getItem(
          'debug.trezor.transport',
        ) === 'ble'
      ) {
        transportHint = 'ble';
      }
    } catch {
      // Ignored: kit-bg might run somewhere without DOM (worker/SW).
    }
    defaultLogger.hardware.sdkLog.log(
      `[3rdPartyHW][Registry] trezor transport hint=${transportHint ?? 'default(all)'}`,
    );
    let connector: Awaited<ReturnType<typeof createTrezorConnector>>;
    if (platformEnv.isExtensionBackground) {
      const { getOffscreenHardwareBridgeClient } =
        await import('./offscreenHardwareBridgeClient');
      connector = await (
        createTrezorConnector as (options: {
          bridge: IHardwareBridge;
        }) => ReturnType<typeof createTrezorConnector>
      )({ bridge: getOffscreenHardwareBridgeClient() });
    } else {
      connector = await (
        createTrezorConnector as (
          t?: 'usb' | 'ble',
        ) => ReturnType<typeof createTrezorConnector>
      )(transportHint);
    }

    // Warm-load persisted THP credentials before the first session. Credentials
    // now live per-device in each Trezor's IDBDevice settings (so forget-device
    // clears them for free), so gather them across all devices and seed the
    // connector. On the extension path setKnownCredentials round-trips into the
    // offscreen connector via the bridge; on other platforms it sets directly.
    // Either way, the next `ThpHandshakeInitRequest` ships these to the device
    // and the device routes to autoconnect, skipping CodeEntry / QrCode / NFC.
    try {
      const localDbModule =
        await import('@onekeyhq/kit-bg/src/dbs/local/localDb');
      const localDb = localDbModule.default;
      const { devices } = await localDb.getAllDevices();
      // Only Trezor devices ever store thpCredentials, so presence is enough.
      const stored = devices.flatMap(
        (device) => device.settings?.thpCredentials ?? [],
      );
      const validStored = stored.filter(isTrezorThpCredential);
      defaultLogger.hardware.sdkLog.log(
        `[3rdPartyHW][Registry] trezor warm-load credentials count=${stored.length} valid=${validStored.length}`,
      );
      const hasSetKnownCredentials =
        typeof connector.setKnownCredentials === 'function';
      defaultLogger.hardware.sdkLog.log(
        `[3rdPartyHW][Registry] trezor warm-load setKnownCredentials=${String(
          hasSetKnownCredentials,
        )} count=${validStored.length}`,
      );
      await connector.setKnownCredentials?.(validStored);
    } catch (error) {
      defaultLogger.hardware.sdkLog.log(
        `[3rdPartyHW][Registry] trezor warm-load failed: ${
          (error as Error)?.message ?? String(error)
        }`,
      );
    }

    const HwkTrezorAdapterCtor = HwkTrezorAdapter as unknown as new (
      adapterConnector: typeof connector,
    ) => InstanceType<typeof HwkTrezorAdapter>;
    const hw = new HwkTrezorAdapterCtor(connector);
    await registerThirdPartyDevicePermissionHandler(hw, EHardwareVendor.trezor);
    defaultLogger.hardware.sdkLog.log(
      '[3rdPartyHW][Registry] trezor adapter ready',
    );
    return new TrezorAdapter(hw, disposeSdkEvents);
  },
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
    await registerThirdPartyDevicePermissionHandler(hw, EHardwareVendor.ledger);
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
