/** @jest-environment jsdom */

import { act, render, waitFor } from '@testing-library/react';

// jest.mock calls below are hoisted above this import by babel-jest.
import InpageProviderWebView from './InpageProviderWebView.desktop';

import type { IWebViewRef } from './types';

jest.mock('@onekeyfe/cross-inpage-provider-core', () => ({
  consts: {
    JS_BRIDGE_MESSAGE_IPC_CHANNEL: 'onekey-js-bridge',
  },
}));

jest.mock('@onekeyfe/onekey-cross-webview', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    JsBridgeDesktopHost: class MockJsBridgeDesktopHost {
      globalOnMessageEnabled = false;

      webviewWrapper: unknown;
    },
    // Mirrors the real dist/useWebViewBridge.js so parent re-render
    // behavior matches production.
    useWebViewBridge: () => {
      const webviewRef = React.useRef<unknown>(null);
      const [jsBridge, setJsBridge] = React.useState<unknown>(null);
      const setWebViewRef = (ref: { jsBridge?: unknown } | null) => {
        webviewRef.current = ref;
        const newJsBridge = ref?.jsBridge;
        if (newJsBridge) {
          setJsBridge(newJsBridge);
        }
      };
      return { jsBridge, webviewRef, setWebViewRef };
    },
  };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    connectBridge: jest.fn(),
  },
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useDevSettingsPersistAtom: () => [
    {
      enabled: false,
      settings: {},
    },
  ],
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    Stack: ({
      children,
      ...props
    }: {
      children?: React.ReactNode;
      [key: string]: unknown;
    }) => React.createElement('div', props, children),
    Progress: (props: Record<string, unknown>) =>
      React.createElement('div', { 'data-testid': 'progress', ...props }),
    Spinner: (props: Record<string, unknown>) =>
      React.createElement('div', { 'data-testid': 'spinner', ...props }),
  };
});

jest.mock('@onekeyhq/shared/src/background/backgroundUtils', () => ({
  waitForDataLoaded: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/utils/stringUtils', () => ({
  __esModule: true,
  default: {
    generateUUID: () => 'test-uuid',
  },
}));

jest.mock('./ErrorView', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    __esModule: true,
    default: () => React.createElement('div', null, 'error'),
  };
});

const SRC = 'https://tradingview.example.com/?symbol=BTC&type=perps';

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function dispatch(
  node: Element,
  type: string,
  props: Record<string, unknown> = {},
) {
  const event = new Event(type);
  Object.assign(event, props);
  act(() => {
    node.dispatchEvent(event);
  });
}

function mount(getPreloadJsContent: jest.Mock) {
  Object.defineProperty(globalThis, 'desktopApiProxy', {
    configurable: true,
    value: {
      webview: {
        getPreloadJsContent,
      },
    },
  });

  const captured: { current: IWebViewRef | null } = { current: null };
  const { container } = render(
    <InpageProviderWebView
      ref={(ref: IWebViewRef | null) => {
        captured.current = ref;
      }}
      src={SRC}
      receiveHandler={jest.fn()}
      allowpopups={false}
      displayProgressBar={false}
    />,
  );
  return { container, captured };
}

async function getWebviewNode(container: HTMLElement) {
  await waitFor(() => {
    expect(container.querySelector('webview')).not.toBeNull();
  });
  const node = container.querySelector('webview') as Element & {
    executeJavaScript: jest.Mock;
  };
  node.executeJavaScript = jest.fn();
  return node;
}

function sendSymbolChange(
  captured: { current: IWebViewRef | null },
  symbol: string,
) {
  act(() => {
    captured.current?.sendMessageViaInjectedScript({
      type: 'SYMBOL_CHANGE',
      payload: { symbol },
    });
  });
}

function deliveredSymbols(node: { executeJavaScript: jest.Mock }): string[] {
  return node.executeJavaScript.mock.calls
    .map((call) => /MARKER_(\w+)/.exec(String(call[0]))?.[1])
    .filter((marker): marker is string => Boolean(marker));
}

// Regression coverage: (1) deferred preload left load listeners unregistered
// so sends queued forever; (2) wrappers captured a stale isDomReady snapshot.
describe('desktop webview injected message delivery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delivers messages when preload resolves after first render', async () => {
    const preload = createDeferred<string>();
    const { container, captured } = mount(
      jest.fn().mockReturnValue(preload.promise),
    );

    // regression precondition: webview must mount after the first render
    expect(container.querySelector('webview')).toBeNull();

    await act(async () => {
      preload.resolve('file:///preload.js');
      await preload.promise;
    });
    const node = await getWebviewNode(container);

    dispatch(node, 'did-start-loading');
    dispatch(node, 'dom-ready');
    dispatch(node, 'did-finish-load');
    dispatch(node, 'did-stop-loading');

    sendSymbolChange(captured, 'MARKER_deferred');
    expect(deliveredSymbols(node)).toContain('deferred');
    // consumers gate registration on innerRef (WebContent.desktop), so the
    // wrapper snapshot must refresh after the deferred mount
    expect(captured.current?.innerRef).toBe(node);
  });

  it('flushes messages queued before dom-ready', async () => {
    const { container, captured } = mount(
      jest.fn().mockResolvedValue('file:///preload.js'),
    );
    const node = await getWebviewNode(container);

    dispatch(node, 'did-start-loading');
    sendSymbolChange(captured, 'MARKER_early');
    expect(deliveredSymbols(node)).not.toContain('early');

    dispatch(node, 'dom-ready');
    expect(deliveredSymbols(node)).toContain('early');
  });

  it('delivers messages when dom-ready arrives after the last parent render', async () => {
    const { container, captured } = mount(
      jest.fn().mockResolvedValue('file:///preload.js'),
    );
    const node = await getWebviewNode(container);

    dispatch(node, 'did-start-loading');
    dispatch(node, 'did-finish-load');
    dispatch(node, 'did-stop-loading');
    // let the progress-bar timers settle so no parent render follows dom-ready
    await act(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 150);
      });
    });
    dispatch(node, 'dom-ready');

    sendSymbolChange(captured, 'MARKER_late');
    expect(deliveredSymbols(node)).toContain('late');
  });
});
