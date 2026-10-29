import { consts } from '@onekeyfe/cross-inpage-provider-core';

import {
  guardOffscreenPort,
  isTrustedOffscreenPort,
} from './offscreenPortGuard';

import type { JsBridgeExtBackground } from '@onekeyfe/extension-bridge-hosted';

const EXT_ID = 'abcdefghijklmnopabcdefghijklmnop';
const EXT_ORIGIN = `chrome-extension://${EXT_ID}`;

const globals = globalThis as unknown as {
  chrome?: { runtime: { id: string; getURL: (path: string) => string } };
};
const savedChrome = globals.chrome;

beforeEach(() => {
  globals.chrome = {
    runtime: { id: EXT_ID, getURL: (path) => `${EXT_ORIGIN}/${path}` },
  };
});
afterEach(() => {
  globals.chrome = savedChrome;
});

function port(
  name: string,
  sender: chrome.runtime.MessageSender | undefined,
): chrome.runtime.Port & { disconnect: jest.Mock } {
  return {
    name,
    sender,
    disconnect: jest.fn(),
  } as unknown as chrome.runtime.Port & {
    disconnect: jest.Mock;
  };
}

describe('offscreen port guard', () => {
  it.each([
    [
      'the offscreen document',
      { id: EXT_ID, url: `${EXT_ORIGIN}/offscreen.html` },
      true,
    ],
    [
      'the reloaded offscreen document',
      { id: EXT_ID, url: `${EXT_ORIGIN}/offscreen.html#r` },
      true,
    ],
    [
      'a content script',
      { id: EXT_ID, url: 'https://dapp.example/', tab: { id: 1 } },
      false,
    ],
    [
      'a content script without tab info',
      { id: EXT_ID, url: 'https://dapp.example/' },
      false,
    ],
    [
      'another extension page',
      { id: EXT_ID, url: `${EXT_ORIGIN}/ui-popup.html` },
      false,
    ],
    [
      'an expanded tab',
      { id: EXT_ID, url: `${EXT_ORIGIN}/offscreen.html`, tab: { id: 2 } },
      false,
    ],
    [
      'another extension',
      { id: 'other', url: `chrome-extension://other/offscreen.html` },
      false,
    ],
    ['no sender', undefined, false],
  ])('%s', (_label, sender, trusted) => {
    expect(
      isTrustedOffscreenPort(
        port(
          consts.EXT_PORT_OFFSCREEN_TO_BG,
          sender as chrome.runtime.MessageSender,
        ),
      ),
    ).toBe(trusted);
  });

  function guardedBridge() {
    const addPort = jest.fn();
    const bridge = { addPort } as unknown as JsBridgeExtBackground;
    guardOffscreenPort(bridge);
    return { bridge, addPort };
  }

  it('closes an impostor offscreen port instead of registering it', () => {
    const { bridge, addPort } = guardedBridge();
    const impostor = port(consts.EXT_PORT_OFFSCREEN_TO_BG, {
      id: EXT_ID,
      url: 'https://dapp.example/',
      tab: { id: 1 } as chrome.tabs.Tab,
    });
    bridge.addPort({ portId: 'p1', port: impostor });
    expect(addPort).not.toHaveBeenCalled();
    expect(impostor.disconnect).toHaveBeenCalled();
  });

  it('registers the real offscreen port and leaves other ports alone', () => {
    const { bridge, addPort } = guardedBridge();
    const offscreen = port(consts.EXT_PORT_OFFSCREEN_TO_BG, {
      id: EXT_ID,
      url: `${EXT_ORIGIN}/offscreen.html`,
    });
    const contentScript = port(consts.EXT_PORT_CS_TO_BG, {
      id: EXT_ID,
      url: 'https://dapp.example/',
      tab: { id: 1 } as chrome.tabs.Tab,
    });
    const ui = port(consts.EXT_PORT_UI_TO_BG, {
      id: EXT_ID,
      url: `${EXT_ORIGIN}/ui-popup.html`,
    });
    bridge.addPort({ portId: 'p1', port: offscreen });
    bridge.addPort({ portId: 'p2', port: contentScript });
    bridge.addPort({ portId: 'p3', port: ui });
    expect(addPort).toHaveBeenCalledTimes(3);
    expect(offscreen.disconnect).not.toHaveBeenCalled();
  });
});
