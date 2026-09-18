/**
 * @jest-environment jsdom
 */

import type { PropsWithChildren } from 'react';

import { act, render } from '@testing-library/react';

import { WebView } from './WebView.desktop';

jest.mock('@onekeyhq/components', () => ({
  Stack: ({ children }: PropsWithChildren) => <div>{children}</div>,
}));

describe('desktop TradingView loading', () => {
  it('reports main-frame failures but ignores cancellations and subresources', () => {
    const onLoadError = jest.fn();
    const { container, unmount } = render(
      <WebView
        style={{ flex: 1 }}
        tradingViewProps={{
          uri: 'https://example.com/chart',
          injectedJavaScript: '',
        }}
        onLoadEnd={jest.fn()}
        onLoadError={onLoadError}
      />,
    );
    const webview = container.querySelector('webview');
    const fail = (errorCode: number, isMainFrame: boolean) => {
      act(() => {
        webview?.dispatchEvent(
          Object.assign(new Event('did-fail-load'), {
            errorCode,
            isMainFrame,
          }),
        );
      });
    };
    fail(-3, true);
    fail(-111, false);
    expect(onLoadError).not.toHaveBeenCalled();
    fail(-111, true);
    expect(onLoadError).toHaveBeenCalledTimes(1);
    unmount();
    fail(-111, true);
    expect(onLoadError).toHaveBeenCalledTimes(1);
  });
});
