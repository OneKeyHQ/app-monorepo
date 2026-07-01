import { OneKeyLocalError } from '../../errors';
import { logHwk } from '../hwkLogger';
import { getTrezorThpIdentity } from '../trezorThpIdentity';

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

const trezorThpIdentity = getTrezorThpIdentity();

const THP = {
  hostName: trezorThpIdentity.hostName,
  appName: trezorThpIdentity.appName,
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
