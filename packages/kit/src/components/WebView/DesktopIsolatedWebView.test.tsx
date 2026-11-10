/** @jest-environment jsdom */

import { act, render, screen } from '@testing-library/react';

import {
  EWebEmbedPrivateRequestMethod,
  PRIME_PURCHASE_CONSOLE_MESSAGE_PREFIX,
} from '@onekeyhq/shared/src/consts/webEmbedConsts';

import {
  DesktopIsolatedWebView,
  isTrustedPrimePurchaseUrl,
} from './DesktopIsolatedWebView';

import type { IWebViewRef } from './types';

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
  };
});

jest.mock('./ErrorView', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    __esModule: true,
    default: () => React.createElement('div', null, 'error'),
  };
});

describe('DesktopIsolatedWebView', () => {
  it('mounts immediately without a preload attribute and exposes innerRef', () => {
    const captured: { current: IWebViewRef | null } = { current: null };
    render(
      <DesktopIsolatedWebView
        data-testid="isolated-webview"
        src="https://intercom.onekey.so/#bridge=injected-v1"
        ref={(ref: IWebViewRef | null) => {
          captured.current = ref;
        }}
      />,
    );

    const webview = screen.getByTestId('isolated-webview');
    expect(webview.getAttribute('preload')).toBeNull();
    expect(webview.getAttribute('nodeintegration')).toBe('false');
    expect(captured.current?.innerRef).toBe(webview);
  });

  it('delivers $private console messages only from a matching ?render=prime-purchase app shell', () => {
    const receiveHandler = jest.fn();
    const src =
      'file:///Applications/OneKey.app/Contents/Resources/app.asar/build/index.html?render=prime-purchase#/prime/purchase?primeUserId=user-1';
    render(
      <DesktopIsolatedWebView
        data-testid="isolated-prime-webview"
        src={src}
        receiveHandler={receiveHandler}
      />,
    );

    const webview = screen.getByTestId('isolated-prime-webview') as Element & {
      getURL?: () => string;
    };
    webview.getURL = () => src;

    const closePayload = {
      scope: '$private',
      data: {
        method: EWebEmbedPrivateRequestMethod.closeWebViewModal,
      },
    };
    const event = new Event('console-message');
    Object.assign(event, {
      message: `${PRIME_PURCHASE_CONSOLE_MESSAGE_PREFIX}${JSON.stringify(
        closePayload,
      )}`,
    });
    act(() => {
      webview.dispatchEvent(event);
    });
    expect(receiveHandler).toHaveBeenCalledTimes(1);
    expect(receiveHandler).toHaveBeenCalledWith(closePayload, undefined);

    // Reject non-$private scope (e.g. ethereum RPC)
    const ethereumEvent = new Event('console-message');
    Object.assign(ethereumEvent, {
      message: `${PRIME_PURCHASE_CONSOLE_MESSAGE_PREFIX}${JSON.stringify({
        scope: 'ethereum',
        data: { method: 'eth_requestAccounts' },
      })}`,
    });
    act(() => {
      webview.dispatchEvent(ethereumEvent);
    });
    expect(receiveHandler).toHaveBeenCalledTimes(1);

    // Reject if the guest navigated away from the ?render=prime-purchase shell
    webview.getURL = () => 'https://js.stripe.com/v3';
    act(() => {
      webview.dispatchEvent(event);
    });
    expect(receiveHandler).toHaveBeenCalledTimes(1);
  });

  it('validates prime purchase URLs strictly', () => {
    const prodUrl =
      'file:///Applications/OneKey.app/build/index.html?render=prime-purchase#/prime/purchase';
    expect(isTrustedPrimePurchaseUrl(prodUrl, prodUrl)).toBe(true);
    expect(
      isTrustedPrimePurchaseUrl(
        'file:///other/index.html?render=prime-purchase',
        prodUrl,
      ),
    ).toBe(false);
    expect(
      isTrustedPrimePurchaseUrl(
        'https://evil.example/?render=prime-purchase',
        prodUrl,
      ),
    ).toBe(false);
  });
});
