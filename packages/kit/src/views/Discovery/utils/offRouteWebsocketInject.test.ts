import vm from 'vm';

import {
  injectToPauseWebsocket,
  injectToPauseWebsocketOffRoute,
  injectToResumeWebsocket,
  injectToResumeWebsocketOffRoute,
} from './explorerUtils';

// The injected strings run inside a guest WebView, so exercise them the same
// way: build a minimal page realm and eval them against it.
function createPageRealm() {
  const realSend = function send() {
    return 'real';
  };
  const win: Record<string, unknown> & {
    WebSocket: { prototype: { send: () => unknown } };
  } = {
    WebSocket: { prototype: { send: realSend } },
  };
  // The scripts address globals as `window.*`, so make the sandbox its own
  // `window`. Inputs are this module's own exported constants, never user data.
  const context = vm.createContext({ window: win });
  const run = (code: string) => {
    vm.runInContext(code, context);
  };
  return {
    run,
    realSend,
    get send() {
      return win.WebSocket.prototype.send;
    },
    get isPaused() {
      return win.WebSocket.prototype.send !== realSend;
    },
  };
}

describe('off-route WebSocket injection', () => {
  it('pauses and restores a page the per-tab policy never touched', () => {
    const page = createPageRealm();
    expect(page.isPaused).toBe(false);

    page.run(injectToPauseWebsocketOffRoute);
    expect(page.isPaused).toBe(true);

    page.run(injectToResumeWebsocketOffRoute);
    expect(page.isPaused).toBe(false);
    expect(page.send).toBe(page.realSend);
  });

  it('leaves a page the per-tab policy paused still paused after restore', () => {
    const page = createPageRealm();
    // setCurrentWebTab -> pauseDappInteraction on the tab being switched away
    page.run(injectToPauseWebsocket);
    expect(page.isPaused).toBe(true);

    // user leaves the browser route, then comes back
    page.run(injectToPauseWebsocketOffRoute);
    page.run(injectToResumeWebsocketOffRoute);

    // still paused: the off-route pass must not undo the per-tab decision
    expect(page.isPaused).toBe(true);

    // and the per-tab policy can still resume it when the tab is activated
    page.run(injectToResumeWebsocket);
    expect(page.isPaused).toBe(false);
    expect(page.send).toBe(page.realSend);
  });

  it('stays correct across repeated leave/return cycles', () => {
    const page = createPageRealm();
    for (let i = 0; i < 3; i += 1) {
      page.run(injectToPauseWebsocketOffRoute);
      expect(page.isPaused).toBe(true);
      page.run(injectToResumeWebsocketOffRoute);
      expect(page.isPaused).toBe(false);
    }
    expect(page.send).toBe(page.realSend);
  });

  it('is idempotent when the same script runs twice', () => {
    const page = createPageRealm();
    page.run(injectToPauseWebsocketOffRoute);
    page.run(injectToPauseWebsocketOffRoute);
    expect(page.isPaused).toBe(true);

    page.run(injectToResumeWebsocketOffRoute);
    page.run(injectToResumeWebsocketOffRoute);
    expect(page.isPaused).toBe(false);
    expect(page.send).toBe(page.realSend);
  });

  it('does nothing on resume if the page was never paused off-route', () => {
    const page = createPageRealm();
    page.run(injectToResumeWebsocketOffRoute);
    expect(page.send).toBe(page.realSend);
  });
});
