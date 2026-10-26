/** @jest-environment jsdom */

import { useLayoutEffect } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';

import enCatalog from '@onekeyhq/shared/src/locale/json/en_US.json';
import zhCatalog from '@onekeyhq/shared/src/locale/json/zh_CN.json';

import CaptchaFrameComponent from './CaptchaFrame';

import type { ICaptchaFrameProps } from './captchaMessage';

const enMessages: Record<string, string> = enCatalog;
const zhMessages: Record<string, string> = zhCatalog;
let locale = 'en-US';

function CaptchaFrame(props: ICaptchaFrameProps) {
  return (
    <IntlProvider
      locale={locale}
      messages={locale === 'zh-CN' ? zhMessages : enMessages}
    >
      <CaptchaFrameComponent {...props} />
    </IntlProvider>
  );
}

beforeEach(() => {
  locale = 'en-US';
});

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

beforeEach(() => {
  // The shared Jest setup replaces listeners; restore DOM dispatch here.
  const eventTarget: EventTarget = globalThis.window;
  jest
    .spyOn(eventTarget, 'addEventListener')
    .mockImplementation((type, listener, options) => {
      EventTarget.prototype.addEventListener.call(
        eventTarget,
        type,
        listener,
        options,
      );
    });
  jest
    .spyOn(eventTarget, 'removeEventListener')
    .mockImplementation((type, listener, options) => {
      EventTarget.prototype.removeEventListener.call(
        eventTarget,
        type,
        listener,
        options,
      );
    });
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

// jsdom does not implement MessageChannel. Exercise the receiver lifecycle here;
// the paired hosted-page contract is also checked with real ports in Chromium.
class TestPort implements MessagePort {
  onmessage: MessagePort['onmessage'] = null;

  onmessageerror: MessagePort['onmessageerror'] = null;

  close = jest.fn();

  start = jest.fn();

  postMessage = jest.fn();

  addEventListener = jest.fn();

  removeEventListener = jest.fn();

  dispatchEvent = jest.fn(() => true);

  send(data: unknown) {
    act(() => {
      this.onmessage?.call(this, new MessageEvent('message', { data }));
    });
  }
}

const origin = 'https://login.onekeytest.com';
const requestId = 'current';
const url = `${origin}/captcha#requestId=${requestId}`;
const success = {
  type: 'onekey-test-captcha',
  requestId,
  status: 'success',
  token: 'verified-token',
};
const ready = { type: 'onekey-test-captcha', requestId, status: 'ready' };
const handshake = { type: 'onekey-captcha-bridge', version: 1, requestId };

function CommitProbe({
  children,
  onCommit,
}: {
  children: import('react').ReactNode;
  onCommit: () => void;
}) {
  useLayoutEffect(onCommit, [onCommit]);
  return children;
}

function sendWindowMessage(
  frame: HTMLIFrameElement,
  options: MessageEventInit<unknown> = {},
) {
  act(() => {
    globalThis.dispatchEvent(
      new MessageEvent('message', {
        origin,
        source: frame.contentWindow,
        data: handshake,
        ...options,
      }),
    );
  });
}

function connect(frame: HTMLIFrameElement) {
  const port = new TestPort();
  sendWindowMessage(frame, { ports: [port] });
  return port;
}

test('requires the document channel and validates the handshake and results', () => {
  const onResult = jest.fn();
  render(<CaptchaFrame url={url} requestId={requestId} onResult={onResult} />);
  const frame = screen.getByTitle<HTMLIFrameElement>('Security verification');
  expect(
    new URLSearchParams(new URL(frame.src).hash.slice(1)).get('bridge'),
  ).toBe('message-channel-v1');
  for (const options of [
    { origin: 'https://untrusted.example.com' },
    { origin: 'null' },
    { source: globalThis.window },
    { data: { ...handshake, requestId: 'stale' } },
    { data: { ...handshake, version: 2 } },
    { data: success },
    { data: null },
  ]) {
    const invalidPort = new TestPort();
    sendWindowMessage(frame, { ports: [invalidPort], ...options });
    expect(invalidPort.onmessage).toBeNull();
  }
  sendWindowMessage(frame); // A handshake without a port cannot enable results.
  sendWindowMessage(frame, { data: success });
  expect(onResult).not.toHaveBeenCalled();
  const port = connect(frame);
  expect(frame.style.visibility).toBe('hidden');
  port.send({ ...success, requestId: 'stale' });
  port.send({ ...success, token: '' });
  expect(onResult).not.toHaveBeenCalled();
  port.send(success);
  expect(onResult).toHaveBeenCalledWith(success);
  expect(frame.style.visibility).toBe('visible');
});

test('same-origin window messages and replacement ports cannot complete a bound attempt', () => {
  const onResult = jest.fn();
  render(<CaptchaFrame url={url} requestId={requestId} onResult={onResult} />);
  const frame = screen.getByTitle<HTMLIFrameElement>('Security verification');
  const port = connect(frame);
  port.send(ready);
  sendWindowMessage(frame, { data: success });
  const replacement = connect(frame);
  replacement.send(success);
  expect(replacement.onmessage).toBeNull();
  expect(onResult).toHaveBeenCalledTimes(1);
  port.send(success);
  expect(onResult).toHaveBeenLastCalledWith(success);
});

test.each(['no bridge', 'legacy window bridge', 'handshake only'])(
  '%s cannot clear the startup deadline or reveal a blank/error page',
  (mode) => {
    jest.useFakeTimers();
    const onResult = jest.fn();
    render(
      <CaptchaFrame url={url} requestId={requestId} onResult={onResult} />,
    );
    const frame = screen.getByTitle<HTMLIFrameElement>('Security verification');
    fireEvent.load(frame); // Browsers also fire load for error documents.
    const port = mode === 'handshake only' ? connect(frame) : undefined;
    if (mode === 'legacy window bridge') {
      sendWindowMessage(frame, { data: ready });
      sendWindowMessage(frame, { data: success });
    }
    expect(frame.style.visibility).toBe('hidden');
    act(() => jest.advanceTimersByTime(30_000));
    port?.send(success);
    sendWindowMessage(frame, { data: success });
    expect(onResult.mock.calls).toEqual([
      [{ type: 'onekey-test-captcha', requestId, status: 'load-error' }],
    ]);
    expect(screen.queryByTitle('Security verification')).toBeNull();
    if (port) expect(port.close).toHaveBeenCalled();
  },
);

test.each(['second load', 'pagehide', 'port error', 'frame error'])(
  '%s ends the attempt once and prevents late results',
  (failure) => {
    jest.useFakeTimers();
    const onResult = jest.fn();
    render(
      <CaptchaFrame url={url} requestId={requestId} onResult={onResult} />,
    );
    const frame = screen.getByTitle<HTMLIFrameElement>('Security verification');
    const port = connect(frame);
    const lateResult = port.onmessage;
    port.send(ready);
    fireEvent.load(frame);
    act(() => {
      if (failure === 'second load') fireEvent.load(frame);
      if (failure === 'pagehide') port.send({ ...ready, status: 'load-error' });
      if (failure === 'port error') {
        port.onmessageerror?.call(port, new MessageEvent('messageerror'));
      }
      if (failure === 'frame error') fireEvent.error(frame);
      lateResult?.call(port, new MessageEvent('message', { data: success }));
      jest.advanceTimersByTime(30_000);
    });
    expect(onResult.mock.calls).toEqual([
      [{ ...ready, token: undefined }],
      [{ ...ready, status: 'load-error' }],
    ]);
    expect(port.close).toHaveBeenCalled();
    expect(screen.queryByTitle('Security verification')).toBeNull();
  },
);

test('provider retries and callback rerenders retain the document channel', () => {
  jest.useFakeTimers();
  const onResult = jest.fn();
  const nextResult = jest.fn();
  const { rerender } = render(
    <CaptchaFrame url={url} requestId={requestId} onResult={onResult} />,
  );
  const frame = screen.getByTitle<HTMLIFrameElement>('Security verification');
  const port = connect(frame);
  port.send(ready);
  fireEvent.load(frame);
  act(() => jest.advanceTimersByTime(180_000));
  expect(screen.queryByTestId('email-otp-captcha-loading')).toBeNull();
  rerender(
    <CaptchaFrame url={url} requestId={requestId} onResult={nextResult} />,
  );
  port.send({ ...ready, status: 'error' });
  port.send({ ...ready, status: 'expired' });
  port.send(success);
  expect(onResult).toHaveBeenCalledTimes(1);
  expect(nextResult).toHaveBeenCalledTimes(3);
  expect(port.close).not.toHaveBeenCalled();
  expect(frame.style.visibility).toBe('visible');
});

test('a new attempt remounts the frame and closes the old port, including on unmount', () => {
  const onResult = jest.fn();
  const { rerender, unmount } = render(
    <CaptchaFrame url={url} requestId={requestId} onResult={onResult} />,
  );
  const frame = screen.getByTitle<HTMLIFrameElement>('Security verification');
  const port = connect(frame);
  const lateResult = port.onmessage;
  port.send(ready);
  rerender(
    <CaptchaFrame
      url={`${origin}/captcha#requestId=next`}
      requestId="next"
      onResult={onResult}
    />,
  );
  const nextFrame = screen.getByTitle<HTMLIFrameElement>(
    'Security verification',
  );
  expect(nextFrame).not.toBe(frame);
  expect(nextFrame.style.visibility).toBe('hidden');
  expect(port.close).toHaveBeenCalled();
  act(() => {
    lateResult?.call(port, new MessageEvent('message', { data: success }));
  });
  const nextPort = new TestPort();
  sendWindowMessage(nextFrame, {
    ports: [nextPort],
    data: { ...handshake, requestId: 'next' },
  });
  nextPort.send({ ...success, requestId: 'next' });
  expect(onResult).toHaveBeenCalledTimes(2);
  const afterUnmount = nextPort.onmessage;
  unmount();
  act(() => {
    afterUnmount?.call(
      nextPort,
      new MessageEvent('message', { data: { ...success, requestId: 'next' } }),
    );
  });
  expect(nextPort.close).toHaveBeenCalled();
  expect(onResult).toHaveBeenCalledTimes(2);
});

test('old pagehide cannot fail a new attempt in the commit before passive cleanup', () => {
  const onResult = jest.fn();
  const { rerender } = render(
    <CommitProbe onCommit={() => {}}>
      <CaptchaFrame url={url} requestId={requestId} onResult={onResult} />
    </CommitProbe>,
  );
  const frame = screen.getByTitle<HTMLIFrameElement>('Security verification');
  const port = connect(frame);
  const lateResult = port.onmessage;
  port.send(ready);
  rerender(
    <CommitProbe
      onCommit={() => {
        lateResult?.call(
          port,
          new MessageEvent('message', {
            data: { ...ready, status: 'load-error' },
          }),
        );
      }}
    >
      <CaptchaFrame
        url={`${origin}/captcha#requestId=next`}
        requestId="next"
        onResult={onResult}
      />
    </CommitProbe>,
  );
  expect(port.close).toHaveBeenCalled();
  expect(onResult).toHaveBeenCalledTimes(1);
});

test('localizes loading and title without replacing the frame or extending startup', () => {
  jest.useFakeTimers();
  const onResult = jest.fn();
  const { rerender } = render(
    <CaptchaFrame url={url} requestId={requestId} onResult={onResult} />,
  );
  const frame = screen.getByTitle('Security verification');
  act(() => jest.advanceTimersByTime(20_000));
  locale = 'zh-CN';
  rerender(
    <CaptchaFrame url={url} requestId={requestId} onResult={onResult} />,
  );
  expect(screen.getByTitle('安全验证')).toBe(frame);
  expect(screen.getByText('正在加载安全验证…')).toBeTruthy();
  act(() => jest.advanceTimersByTime(10_000));
  expect(onResult).toHaveBeenCalledTimes(1);
  expect(onResult).toHaveBeenCalledWith(
    expect.objectContaining({ status: 'load-error' }),
  );
});
