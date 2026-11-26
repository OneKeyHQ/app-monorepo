import { consts } from '@onekeyfe/cross-inpage-provider-core';

import { reportOffscreenPortDisconnected } from '@onekeyhq/kit-bg/src/offscreens/offscreenDocument';

import type { JsBridgeExtBackground } from '@onekeyfe/extension-bridge-hosted';

// Created by keepAlive.ts; the only document that may own the offscreen port.
export const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';

export function isTrustedOffscreenPort(port: chrome.runtime.Port): boolean {
  const { sender } = port;
  if (!sender || sender.id !== chrome.runtime.id || sender.tab) {
    return false;
  }
  try {
    const url = new URL(sender.url ?? '');
    const expected = new URL(chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH));
    return url.origin === expected.origin && url.pathname === expected.pathname;
  } catch {
    return false;
  }
}

/**
 * The hosted bridge accepts any port by name and lets the newest offscreen
 * port replace the current one, then sends it key-bearing offscreen calls. A
 * content script can open a port with that name too, so require the sender to
 * be this extension's offscreen document.
 *
 * It also reports when the trusted offscreen port goes away, so code that
 * runs things in the offscreen document can tell they are gone
 * (kit-bg/src/offscreens/offscreenDocument.ts).
 */
export function guardOffscreenPort(bridge: JsBridgeExtBackground) {
  const addPort = bridge.addPort.bind(bridge);
  const removePort = bridge.removePort.bind(bridge);
  const trustedPortIds = new Set<string | number>();
  bridge.addPort = ({ portId, port }) => {
    if (port.name !== consts.EXT_PORT_OFFSCREEN_TO_BG) {
      addPort({ portId, port });
      return;
    }
    if (!isTrustedOffscreenPort(port)) {
      // Closing it inside onConnect means none of its messages are delivered.
      port.disconnect();
      return;
    }
    addPort({ portId, port });
    trustedPortIds.add(portId);
  };
  bridge.removePort = ({ portId, port }) => {
    removePort({ portId, port });
    if (trustedPortIds.delete(portId)) {
      reportOffscreenPortDisconnected();
    }
  };
}
