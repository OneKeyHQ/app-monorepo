import { OneKeyLocalError } from '../../errors';
import { defaultLogger } from '../../logger/logger';

import type { IConnector } from '@onekeyfe/hwk-adapter-core';
import type { TrezorBleApi } from '@onekeyfe/hwk-trezor-connector-electron-ble';

/**
 * Transport mode for the desktop Trezor connector.
 *   'all' → (default) fuse every available transport (WebUSB + BLE) into one
 *           connector via `createCombinedConnector`. `searchDevices()` returns
 *           the union, each device tagged with its `connectionType`; `connect()`
 *           routes back to the transport that owns the chosen device. Mirrors
 *           Trezor Connect's DeviceList (one manager per transport, merged list).
 *   'usb' → WebUSB only (renderer process).
 *   'ble' → BLE only, via noble-on-main behind `window.desktopApi.thirdPartyBle`
 *           (wired by `initTrezorBleSupport()` in `apps/desktop/app/app.ts`).
 *           Use to isolate one transport while debugging.
 */
export type TrezorDesktopTransport = 'all' | 'usb' | 'ble';

const TREZOR_THP_MODULE_REDACTED_KEYS = new Set([
  'credential',
  'credentials',
  'trezor_static_public_key',
  'host_static_key',
  'privateKey',
  'publicKey',
  'hostKey',
  'trezorKey',
  'encryptedPayload',
  'packetHex',
  'pin',
  'passphrase',
  'stack',
  'sendNonce',
  'recvNonce',
]);

const TREZOR_THP_MODULE_REDACTED_DATA_KEY_VALUES = new Set([
  'credential',
  'credentials',
  'trezor_static_public_key',
  'host_static_key',
  'pin',
  'passphrase',
]);

const shouldForwardToTrezorThpModuleLog = (entry: {
  event: string;
  data?: Record<string, unknown>;
  thpModuleForwarded?: boolean;
}) => {
  if (entry.thpModuleForwarded) return false;
  if (entry.event === 'thp.loop') return false;
  if (entry.event.startsWith('thp.')) return true;
  if (entry.event === 'session.initialize.thp.fallback') return true;
  if (entry.event === 'session.initialize.done') {
    return entry.data?.protocol === 'thp';
  }
  if (entry.event.startsWith('session.method.')) {
    return entry.data?.protocol === 'thp';
  }
  return false;
};

const sanitizeTrezorThpModuleLogValue = (
  key: string,
  value: unknown,
): unknown => {
  if (TREZOR_THP_MODULE_REDACTED_KEYS.has(key)) return '[redacted]';
  if (Array.isArray(value)) {
    if (key === 'dataKeys' || key === 'messageKeys') {
      return value.filter(
        (item) =>
          typeof item !== 'string' ||
          !TREZOR_THP_MODULE_REDACTED_DATA_KEY_VALUES.has(item),
      );
    }
    return value.map((item) => sanitizeTrezorThpModuleLogValue(key, item));
  }
  if (value && typeof value === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(
      value as Record<string, unknown>,
    )) {
      sanitized[childKey] = sanitizeTrezorThpModuleLogValue(
        childKey,
        childValue,
      );
    }
    return sanitized;
  }
  return value;
};

const sanitizeTrezorThpModuleLogData = (
  data?: Record<string, unknown>,
): Record<string, unknown> | undefined => {
  if (!data) return undefined;
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    sanitized[key] = sanitizeTrezorThpModuleLogValue(key, value);
  }
  return sanitized;
};

const formatTrezorHwkLog = (
  prefix: string,
  event: string,
  data?: Record<string, unknown>,
) => {
  if (!data) return `${prefix} ${event}`;
  return `${prefix} ${event} ${JSON.stringify(data)}`;
};

const logHwk = (entry: {
  level: 'debug' | 'info' | 'warn' | 'error';
  scope: string;
  event: string;
  data?: Record<string, unknown>;
  thpModuleForwarded?: boolean;
}) => {
  try {
    if (
      typeof process !== 'undefined' &&
      process.env.NODE_ENV === 'production'
    ) {
      return;
    }
    const data = sanitizeTrezorThpModuleLogData(entry.data);
    defaultLogger.hardware.sdkLog.log(
      formatTrezorHwkLog(`[hwk:${entry.scope}]`, entry.event, data),
    );
    if (
      entry.scope !== 'trezor-thp' &&
      shouldForwardToTrezorThpModuleLog(entry)
    ) {
      defaultLogger.hardware.sdkLog.log(
        formatTrezorHwkLog('[hwk:trezor-thp]', entry.event, data),
      );
      defaultLogger.hardware.sdkLog.log(
        formatTrezorHwkLog('[TrezorTHPModule]', entry.event, data),
      );
    }
  } catch {
    // logging must never break the connector
  }
};

const THP = {
  hostName: 'OneKey',
  appName: 'OneKey Wallet',
  // Forward the connector's internal logs (incl. the `[TREZOR_VERIFY]`
  // per-transport scan/connect field dumps) to the hardware SDK logger. Without
  // this the connector's `thp.logger` is undefined and every dump is swallowed.
  logger: logHwk,
} as const;

const getBleBridge = (): TrezorBleApi | undefined =>
  (
    globalThis as {
      window?: { desktopApi?: { thirdPartyBle?: TrezorBleApi } };
    }
  ).window?.desktopApi?.thirdPartyBle;

const makeUsbConnector = async (): Promise<IConnector> => {
  const { createTrezorWebUsbConnector } =
    await import('@onekeyfe/hwk-trezor-connector-webusb');
  return createTrezorWebUsbConnector({
    thp: THP,
    transportOptions: { logger: logHwk },
  });
};

const makeBleConnector = async (bridge: TrezorBleApi): Promise<IConnector> => {
  // The renderer-side BLE connector talks to a `TrezorBleApi`-shaped IPC
  // bridge. We use the vendor-neutral `thirdPartyBle` exposed by preload.ts
  // so other vendors (Ledger BLE etc.) can share the same renderer surface.
  const { createTrezorElectronBleConnector } =
    await import('@onekeyfe/hwk-trezor-connector-electron-ble');
  return createTrezorElectronBleConnector({
    transportOptions: { bridge, logger: logHwk },
    thp: THP,
  });
};

export const createTrezorConnector = async (
  transport: TrezorDesktopTransport = 'all',
): Promise<IConnector> => {
  const bridge = getBleBridge();

  if (transport === 'usb') {
    return makeUsbConnector();
  }

  if (transport === 'ble') {
    if (!bridge) {
      throw new OneKeyLocalError(
        'createTrezorConnector(ble): window.desktopApi.thirdPartyBle is unavailable — preload not loaded or initTrezorBleSupport() not called in main',
      );
    }
    return makeBleConnector(bridge);
  }

  // 'all' — fuse every transport that is actually available on this build.
  // WebUSB always exists in the renderer; BLE only when the preload bridge is
  // present. A connector whose backend is missing is simply not added.
  const connectors: IConnector[] = [await makeUsbConnector()];
  if (bridge) {
    connectors.push(await makeBleConnector(bridge));
  }
  if (connectors.length === 1) {
    // Only one transport available — return it directly (identical behavior to
    // the pre-fusion single-transport path).
    return connectors[0];
  }
  const { createCombinedConnector } =
    await import('@onekeyfe/hwk-adapter-core');
  return createCombinedConnector(connectors);
};
