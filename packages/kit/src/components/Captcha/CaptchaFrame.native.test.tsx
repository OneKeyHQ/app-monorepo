/** @jest-environment jsdom */

import { act, render, screen } from '@testing-library/react';
import { WebView } from 'react-native-webview';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import CaptchaFrame from './CaptchaFrame.native';

import type { NativeSyntheticEvent } from 'react-native';
import type { WebViewProps } from 'react-native-webview';

type ILoadRequest = Parameters<
  NonNullable<WebViewProps['onShouldStartLoadWithRequest']>
>[0];

jest.mock('react-native-webview', () => ({
  WebView: jest.fn(() => null),
}));

jest.mock('@onekeyhq/components', () => {
  const Container = ({
    children,
    testID,
  }: {
    children?: import('react').ReactNode;
    testID?: string;
  }) => <div data-testid={testID}>{children}</div>;
  return {
    Stack: Container,
    XStack: Container,
    SizableText: Container,
    Spinner: () => null,
  };
});

const origin = 'https://captcha.example.com';
const requestId = 'current-challenge';

function renderFrame() {
  const onResult = jest.fn();
  render(
    <CaptchaFrame
      url={`${origin}/captcha#requestId=${requestId}`}
      requestId={requestId}
      onResult={onResult}
    />,
  );
  const props = jest.mocked(WebView).mock.calls.at(-1)?.[0];
  if (!props) throw new OneKeyLocalError('CAPTCHA WebView did not render');
  return { props, onResult };
}

function navigation(url: string, isTopFrame: boolean): ILoadRequest {
  return {
    url,
    isTopFrame,
    mainDocumentURL: url,
    navigationType: 'other',
    loading: false,
    title: '',
    canGoBack: false,
    canGoForward: false,
    lockIdentifier: 1,
  };
}

function nativeEvent<T>(payload: { nativeEvent: T }): NativeSyntheticEvent<T> {
  // These handlers consume only the native payload, not synthetic event methods.
  return payload as NativeSyntheticEvent<T>;
}

afterEach(() => jest.useRealTimers());

describe('native CAPTCHA page loading', () => {
  test('conceals the page until the validated provider bridge starts', () => {
    const { props } = renderFrame();
    expect(screen.getByText('Loading CAPTCHA…')).toBeTruthy();
    expect(props.containerStyle).toMatchObject({ opacity: 0 });
    act(() => {
      props.onMessage?.(
        nativeEvent({
          nativeEvent: {
            ...navigation(origin, true),
            data: JSON.stringify({
              type: 'onekey-test-captcha',
              requestId,
              status: 'ready',
            }),
          },
        }),
      );
    });
    expect(screen.queryByText('Loading CAPTCHA…')).toBeNull();
    expect(
      jest.mocked(WebView).mock.calls.at(-1)?.[0].containerStyle,
    ).toMatchObject({ opacity: 1 });
  });

  test('turns an HTTP 404 page into one load failure and ignores late success', () => {
    const { props, onResult } = renderFrame();
    expect(props.onHttpError).toBeDefined();
    act(() => {
      props.onHttpError?.(
        nativeEvent({
          nativeEvent: {
            ...navigation(origin, true),
            statusCode: 404,
            description: 'NoSuchKey',
          },
        }),
      );
      props.onMessage?.(
        nativeEvent({
          nativeEvent: {
            ...navigation(origin, true),
            data: JSON.stringify({
              type: 'onekey-test-captcha',
              requestId,
              status: 'success',
              token: 'late-token',
            }),
          },
        }),
      );
    });
    expect(onResult.mock.calls).toEqual([
      [{ type: 'onekey-test-captcha', requestId, status: 'load-error' }],
    ]);
    expect(
      jest.mocked(WebView).mock.calls.at(-1)?.[0].containerStyle,
    ).toMatchObject({ opacity: 0 });
  });

  test.each(['network', 'ios-process', 'android-process'] as const)(
    '%s failure reports one terminal load error even if the page never ran',
    (failure) => {
      jest.useFakeTimers();
      const { props, onResult } = renderFrame();
      act(() => {
        if (failure === 'network') {
          props.onError?.(
            nativeEvent({
              nativeEvent: {
                ...navigation(origin, true),
                code: -1,
                description: 'Network request failed',
              },
            }),
          );
        } else if (failure === 'ios-process') {
          props.onContentProcessDidTerminate?.(
            nativeEvent({
              nativeEvent: navigation(origin, true),
            }),
          );
        } else {
          props.onRenderProcessGone?.(
            nativeEvent({
              nativeEvent: { didCrash: true },
            }),
          );
        }
        jest.advanceTimersByTime(30_000);
      });
      expect(onResult.mock.calls).toEqual([
        [{ type: 'onekey-test-captcha', requestId, status: 'load-error' }],
      ]);
      expect(
        jest.mocked(WebView).mock.calls.at(-1)?.[0].containerStyle,
      ).toMatchObject({ opacity: 0 });
    },
  );

  test('times out a page with no bridge response after 30 seconds', () => {
    jest.useFakeTimers();
    const { onResult } = renderFrame();
    act(() => jest.advanceTimersByTime(30_000));
    expect(onResult).toHaveBeenCalledWith({
      type: 'onekey-test-captcha',
      requestId,
      status: 'load-error',
    });
  });

  test('keeps provider recovery active after startup and ignores its child HTTP errors', () => {
    jest.useFakeTimers();
    const { props, onResult } = renderFrame();
    act(() => {
      props.onHttpError?.(
        nativeEvent({
          nativeEvent: {
            ...navigation('https://challenges.cloudflare.com/widget', false),
            statusCode: 400,
            description: 'Retry challenge',
          },
        }),
      );
      props.onMessage?.(
        nativeEvent({
          nativeEvent: {
            ...navigation(origin, true),
            data: JSON.stringify({
              type: 'onekey-test-captcha',
              requestId,
              status: 'error',
            }),
          },
        }),
      );
      jest.advanceTimersByTime(180_000);
    });
    expect(onResult.mock.calls).toEqual([
      [
        {
          type: 'onekey-test-captcha',
          requestId,
          status: 'error',
          token: undefined,
        },
      ],
    ]);
    expect(screen.queryByText('Loading CAPTCHA…')).toBeNull();
  });

  test('a new request hides the previous page and ignores callbacks after unmount', () => {
    jest.useFakeTimers();
    const onResult = jest.fn();
    const props = { url: `${origin}/captcha`, requestId, onResult };
    const { rerender, unmount } = render(<CaptchaFrame {...props} />);
    const oldView = jest.mocked(WebView).mock.calls.at(-1)?.[0];
    act(() =>
      oldView?.onMessage?.(
        nativeEvent({
          nativeEvent: {
            ...navigation(origin, true),
            data: JSON.stringify({
              type: 'onekey-test-captcha',
              requestId,
              status: 'ready',
            }),
          },
        }),
      ),
    );
    expect(screen.queryByText('Loading CAPTCHA…')).toBeNull();
    rerender(<CaptchaFrame {...props} requestId="next" />);
    expect(screen.getByText('Loading CAPTCHA…')).toBeTruthy();
    unmount();
    act(() => {
      oldView?.onHttpError?.(
        nativeEvent({
          nativeEvent: {
            ...navigation(origin, true),
            statusCode: 404,
            description: 'Late failure',
          },
        }),
      );
      jest.advanceTimersByTime(30_000);
    });
    expect(onResult).toHaveBeenCalledTimes(1);
  });
});

describe('native CAPTCHA WebView navigation', () => {
  test('allows the internal documents Turnstile needs through the origin whitelist', () => {
    const { props } = renderFrame();
    expect(props.originWhitelist).toEqual(
      expect.arrayContaining([
        'http://*',
        'https://*',
        'about:blank',
        'about:srcdoc',
      ]),
    );
  });

  test.each(['about:blank', 'about:srcdoc'])(
    'allows the internal Turnstile frame %s',
    (url) => {
      const { props } = renderFrame();
      expect(props.onShouldStartLoadWithRequest?.(navigation(url, false))).toBe(
        true,
      );
    },
  );

  test('keeps external top-level navigation blocked', () => {
    const { props } = renderFrame();
    expect(
      props.onShouldStartLoadWithRequest?.(
        navigation('https://untrusted.example.com', true),
      ),
    ).toBe(false);
  });

  test.each([
    'https://challenges.cloudflare.com/cdn-cgi/challenge-platform/widget',
    'about:blank',
    'about:srcdoc',
  ])(
    'allows Turnstile navigation without Android frame metadata: %s',
    (url) => {
      const { props } = renderFrame();
      const request = navigation(url, false);
      // Android omits this field despite the WebView package's required type.
      Reflect.deleteProperty(request, 'isTopFrame');
      expect(props.onShouldStartLoadWithRequest?.(request)).toBe(true);
    },
  );

  test.each([
    'https://untrusted.example.com',
    'https://challenges.cloudflare.com.evil.example.com',
    'http://challenges.cloudflare.com',
    // eslint-disable-next-line no-script-url -- Verify that script navigation is rejected.
    'javascript:alert(1)',
  ])(
    'rejects unrelated navigation without Android frame metadata: %s',
    (url) => {
      const { props } = renderFrame();
      const request = navigation(url, false);
      Reflect.deleteProperty(request, 'isTopFrame');
      expect(props.onShouldStartLoadWithRequest?.(request)).toBe(false);
    },
  );

  test('does not treat a known iOS top frame as an Android iframe', () => {
    const { props } = renderFrame();
    expect(
      props.onShouldStartLoadWithRequest?.(
        navigation('https://challenges.cloudflare.com', true),
      ),
    ).toBe(false);
  });

  test('only accepts results from the host page and current challenge', () => {
    const { props, onResult } = renderFrame();
    const sendMessage = (url: string, id: string) => {
      props.onMessage?.(
        nativeEvent({
          nativeEvent: {
            ...navigation(url, true),
            data: JSON.stringify({
              type: 'onekey-test-captcha',
              requestId: id,
              status: 'success',
              token: 'fixture-token',
            }),
          },
        }),
      );
    };
    sendMessage('about:blank', requestId);
    sendMessage('https://challenges.cloudflare.com', requestId);
    sendMessage(origin, 'stale-challenge');
    expect(onResult).not.toHaveBeenCalled();
    act(() => sendMessage(origin, requestId));
    expect(onResult).toHaveBeenCalledTimes(1);
  });
});
