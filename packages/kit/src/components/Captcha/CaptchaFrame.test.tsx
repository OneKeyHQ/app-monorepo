/** @jest-environment jsdom */

import { act, fireEvent, render, screen } from '@testing-library/react';

import CaptchaFrame from './CaptchaFrame';

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

test('accepts tokens only from the configured frame origin, window and request', () => {
  const onResult = jest.fn();
  render(
    <CaptchaFrame
      url="https://login.onekeytest.com/captcha/index.html#requestId=current"
      requestId="current"
      onResult={onResult}
    />,
  );
  const frame = screen.getByTitle<HTMLIFrameElement>('Security verification');
  const message = {
    type: 'onekey-test-captcha',
    requestId: 'current',
    status: 'success',
    token: 'verified-token',
  };
  const send = ({
    origin = 'https://login.onekeytest.com',
    source = frame.contentWindow,
    data = message,
  } = {}) => {
    const event = new globalThis.window.MessageEvent('message', {
      origin,
      source,
      data,
    });
    expect(event.origin).toBe(origin);
    expect(event.source).toBe(source);
    act(() => {
      globalThis.dispatchEvent(event);
    });
  };
  send({ origin: 'https://untrusted.example.com' });
  send({ origin: 'null' });
  send({ source: globalThis.window });
  send({ data: { ...message, requestId: 'stale' } });
  expect(onResult).not.toHaveBeenCalled();
  expect(frame.style.visibility).toBe('hidden');
  send();
  expect(onResult).toHaveBeenCalledWith(message);
  expect(frame.style.visibility).toBe('visible');
});

test('keeps an unresponsive error document hidden and reports failure within 30 seconds', () => {
  jest.useFakeTimers();
  const onResult = jest.fn();
  render(
    <CaptchaFrame
      url="https://login.onekeytest.com/captcha#requestId=current"
      requestId="current"
      onResult={onResult}
    />,
  );
  const frame = screen.getByTitle<HTMLIFrameElement>('Security verification');
  expect(frame.style.visibility).toBe('hidden');
  // Browsers also fire load for an iframe error document.
  fireEvent.load(frame);
  expect(frame.style.visibility).toBe('hidden');
  act(() => jest.advanceTimersByTime(30_000));
  expect(onResult).toHaveBeenCalledWith({
    type: 'onekey-test-captcha',
    requestId: 'current',
    status: 'load-error',
  });
});

test('trusted readiness reveals the widget and preserves provider retries; changing the source restarts loading', () => {
  jest.useFakeTimers();
  const onResult = jest.fn();
  const { rerender } = render(
    <CaptchaFrame
      url="https://login.onekeytest.com/captcha#requestId=current"
      requestId="current"
      onResult={onResult}
    />,
  );
  const frame = screen.getByTitle<HTMLIFrameElement>('Security verification');
  act(() => {
    globalThis.dispatchEvent(
      new globalThis.window.MessageEvent('message', {
        origin: 'https://login.onekeytest.com',
        source: frame.contentWindow,
        data: {
          type: 'onekey-test-captcha',
          requestId: 'current',
          status: 'ready',
        },
      }),
    );
  });
  expect(frame.style.visibility).toBe('visible');
  expect(screen.queryByTestId('email-otp-captcha-loading')).toBeNull();
  act(() => jest.advanceTimersByTime(180_000));
  expect(onResult).toHaveBeenCalledTimes(1);
  rerender(
    <CaptchaFrame
      url="https://login.onekey.so/captcha#requestId=next"
      requestId="next"
      onResult={onResult}
    />,
  );
  expect(frame.style.visibility).toBe('hidden');
  expect(screen.getByTestId('email-otp-captcha-loading')).toBeTruthy();
  act(() => jest.advanceTimersByTime(30_000));
  expect(onResult).toHaveBeenLastCalledWith({
    type: 'onekey-test-captcha',
    requestId: 'next',
    status: 'load-error',
  });
});
