import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { IConnector } from '@onekeyfe/hwk-adapter-core';

/**
 * Browser extension: the same file serves both the Service Worker and the
 * Offscreen Document (both are "ext" contexts in webpack resolution).
 *
 * Runtime decides which connector to return:
 *   - Offscreen Document → real WebHID connector. This is where
 *     `navigator.hid` handles and the DMK session live long-lived.
 *   - Service Worker (and other ext contexts) → a bridged connector produced
 *     by `createBridgedConnector`. Every `IConnector` method tunnels to
 *     `OffscreenApiThirdPartyHardware` via the existing `offscreenApiProxy`;
 *     connector events flow back through `offscreenEventBus`.
 *
 * Webpack tree-shaking: both branches are behind dynamic imports, so the SW
 * bundle never pulls `@onekeyfe/hwk-ledger-connector-webhid`, and the
 * offscreen bundle never pulls `swSideHardwareBridge`.
 */
export const createLedgerConnector = async (): Promise<IConnector> => {
  if (platformEnv.isExtensionOffscreen) {
    // Offscreen owns the real device handle.
    const { createLedgerWebHidConnector } = await import(
      '@onekeyfe/hwk-ledger-connector-webhid'
    );
    return createLedgerWebHidConnector();
  }

  // Service Worker / any other ext context: use the bridge so all hardware
  // I/O lands in offscreen, where the connection survives SW termination.
  const [
    { createBridgedConnector },
    { getOffscreenHardwareBridgeClient },
  ] = await Promise.all([
    import('@onekeyfe/hwk-adapter-core'),
    import(
      '@onekeyhq/kit-bg/src/services/ServiceHardware/adapters/offscreenHardwareBridgeClient'
    ),
  ]);
  return createBridgedConnector(
    'ledger',
    getOffscreenHardwareBridgeClient(),
  );
};
