/** @jest-environment jsdom */

import { act, render, screen } from '@testing-library/react';

import CaptchaFrame from './CaptchaFrame.desktop';

import type { ICaptchaMessage } from './captchaMessage';

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual('react') as typeof import('react');
  const Container = ({
    children,
    testID,
  }: {
    children?: import('react').ReactNode;
    testID?: string;
  }) => React.createElement('div', { 'data-testid': testID }, children);
  return {
    Stack: Container,
    XStack: Container,
    SizableText: Container,
    Spinner: () => null,
  };
});

const url = 'https://login.onekeytest.com/captcha#requestId=current';
const preloadPath = 'file:///signed-bundle/static/preload.js';
const getPreload = jest.fn<Promise<string>, []>();
const desktopApi = globalThis.desktopApiProxy;

beforeEach(() => {
  jest.useFakeTimers();
  getPreload.mockReset().mockResolvedValue(preloadPath);
  Object.defineProperty(globalThis, 'desktopApiProxy', {
    configurable: true,
    value: { webview: { getPreloadJsContent: getPreload } },
  });
});

afterEach(() => {
  Object.defineProperty(globalThis, 'desktopApiProxy', {
    configurable: true,
    value: desktopApi,
  });
  jest.useRealTimers();
});

async function mount() {
  const onResult = jest.fn<void, [ICaptchaMessage]>();
  const rendered = render(
    <CaptchaFrame url={url} requestId="current" onResult={onResult} />,
  );
  await act(async () => {
    await Promise.resolve();
  });
  const frame = screen.getByTestId('email-otp-captcha-frame');
  const getURL = jest.fn(() => url);
  const stop = jest.fn();
  Object.assign(frame, { getURL, stop });
  function dispatch(name: string, fields: Record<string, unknown>) {
    const event = new Event(name);
    Object.assign(event, fields);
    act(() => {
      frame.dispatchEvent(event);
    });
  }
  function send(
    status: string,
    fields: Record<string, unknown> = {},
    pageUrl = url,
    channel = 'onekey:captcha-result',
  ) {
    dispatch('ipc-message', {
      channel,
      args: [
        {
          url: pageUrl,
          message: {
            type: 'onekey-test-captcha',
            requestId: 'current',
            status,
            ...fields,
          },
        },
      ],
    });
  }
  return { ...rendered, frame, onResult, getURL, stop, send, dispatch };
}

test('loads the HTTPS page directly, using the existing verified guest preload', async () => {
  const { frame, send, onResult } = await mount();
  expect(frame.getAttribute('preload')).toBe(preloadPath);
  expect((frame as HTMLElement & { src: string }).src).toBe(url);
  expect(frame.getAttribute('partition')).toBe('persist:onekey');
  expect(frame.getAttribute('disableblinkfeatures')).toBe('Notifications');
  expect(frame.style.visibility).toBe('hidden');
  expect(frame.hasAttribute('disablewebsecurity')).toBe(false);
  expect(frame.hasAttribute('allowpopups')).toBe(false);
  expect(frame.hasAttribute('nodeintegration')).toBe(false);
  // ready may arrive before dom-ready. No DOM/load event should be required.
  send('ready');
  expect(frame.style.visibility).toBe('visible');
  expect(screen.queryByTestId('email-otp-captcha-loading')).toBeNull();
  act(() => jest.advanceTimersByTime(180_000));
  expect(onResult).toHaveBeenCalledTimes(1);
  send('success', { token: 'verified-token' });
  expect(onResult).toHaveBeenLastCalledWith(
    expect.objectContaining({ status: 'success', token: 'verified-token' }),
  );
});

test('rejects wrong origins, documents, attempts, channels and stale navigation replies', async () => {
  const { send, onResult, getURL } = await mount();
  send(
    'success',
    { token: 'token' },
    'https://untrusted.example/captcha#requestId=current',
  );
  send(
    'success',
    { token: 'token' },
    'https://login.onekeytest.com/other#requestId=current',
  );
  send('success', { token: 'token', requestId: 'stale' });
  send('success', { token: 'token' }, url, 'wallet:message');
  send('success', { token: '' });
  getURL.mockReturnValue('https://untrusted.example/');
  send('success', { token: 'token' });
  expect(onResult).not.toHaveBeenCalled();
});

test.each(['http://localhost:8800/captcha', 'http://127.0.0.1:8800/captcha'])(
  'rejects the retired local page %s before acquiring the guest preload',
  async (localUrl) => {
    const onResult = jest.fn();
    await act(async () => {
      render(
        <CaptchaFrame url={localUrl} requestId="current" onResult={onResult} />,
      );
    });
    expect(getPreload).not.toHaveBeenCalled();
    expect(screen.queryByTestId('email-otp-captcha-frame')).toBeNull();
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'load-error' }),
    );
  },
);

test.each(['did-finish-load', 'dom-ready'])(
  'does not treat %s as CAPTCHA readiness',
  async (event) => {
    const { dispatch, onResult } = await mount();
    dispatch(event, {});
    act(() => jest.advanceTimersByTime(30_000));
    expect(onResult).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'load-error' }),
    );
    expect(screen.queryByTestId('email-otp-captcha-frame')).toBeNull();
  },
);

test.each([
  ['did-fail-load', { isMainFrame: true, errorCode: -105 }],
  ['did-fail-load', { isMainFrame: true, errorCode: -106 }],
  ['did-fail-load', { isMainFrame: true, errorCode: -202 }],
  ['did-frame-navigate', { url, isMainFrame: true, httpResponseCode: 404 }],
  ['did-frame-navigate', { url, isMainFrame: true, httpResponseCode: 503 }],
  ['render-process-gone', {}],
  ['destroyed', {}],
] as const)('reports load failure for %s %j', async (event, fields) => {
  const { dispatch, onResult } = await mount();
  dispatch(event, fields);
  expect(onResult).toHaveBeenCalledTimes(1);
  expect(onResult).toHaveBeenCalledWith(
    expect.objectContaining({ status: 'load-error' }),
  );
  expect(screen.queryByTestId('email-otp-captcha-frame')).toBeNull();
});

test('leaves child errors and provider retries to the hosted page after ready', async () => {
  const { dispatch, send, onResult, frame } = await mount();
  send('ready');
  dispatch('did-fail-load', { isMainFrame: false, errorCode: -105 });
  dispatch('did-fail-load', { isMainFrame: true, errorCode: -3 });
  send('error');
  act(() => jest.advanceTimersByTime(180_000));
  expect(frame.style.visibility).toBe('visible');
  expect(onResult.mock.calls.map(([message]) => message.status)).toEqual([
    'ready',
    'error',
  ]);
});

test('stops and removes a guest navigating outside the current CAPTCHA attempt', async () => {
  const { dispatch, stop, onResult } = await mount();
  dispatch('did-start-navigation', {
    isMainFrame: true,
    url: 'https://untrusted.example/',
  });
  expect(stop).toHaveBeenCalledTimes(1);
  expect(onResult).toHaveBeenCalledWith(
    expect.objectContaining({ status: 'load-error' }),
  );
});

test('preload errors and stalls are covered by the startup deadline', async () => {
  getPreload.mockImplementation(() => new Promise(() => {}));
  const onResult = jest.fn();
  const { unmount } = render(
    <CaptchaFrame url={url} requestId="current" onResult={onResult} />,
  );
  act(() => jest.advanceTimersByTime(30_000));
  expect(onResult).toHaveBeenCalledWith(
    expect.objectContaining({ status: 'load-error' }),
  );
  unmount();
  onResult.mockClear();
  getPreload.mockRejectedValue(new Error('Integrity verification failed'));
  render(<CaptchaFrame url={url} requestId="current" onResult={onResult} />);
  await act(async () => {
    await Promise.resolve();
  });
  expect(onResult).toHaveBeenCalledWith(
    expect.objectContaining({ status: 'load-error' }),
  );
});
