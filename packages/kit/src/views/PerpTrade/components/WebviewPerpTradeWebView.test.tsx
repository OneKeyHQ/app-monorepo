/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';

import { WebviewPerpTradeWebView } from './WebviewPerpTradeWebView';

let mockTarget: { coin?: string; revision: number } = { revision: 0 };
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useWebviewPerpTradeTargetAtom: () => [mockTarget],
}));
jest.mock('@onekeyhq/kit/src/components/WebView/WebViewWithFeatures', () => ({
  WebViewWithFeatures: ({ src }: { src: string }) => (
    <div data-testid="webview" data-src={src} />
  ),
}));

beforeEach(() => {
  mockTarget = { revision: 0 };
});

it('preserves the default trade page without an explicit target', () => {
  render(<WebviewPerpTradeWebView />);
  expect(screen.getByTestId('webview').getAttribute('data-src')).toBe(
    'https://app.hyperliquid.xyz/trade?isOneKeyBuiltInPerpView=true',
  );
});

it('loads a target recorded before mount and switches an already mounted webview', () => {
  mockTarget = { coin: 'BTC', revision: 1 };
  const { rerender } = render(<WebviewPerpTradeWebView />);
  expect(screen.getByTestId('webview').getAttribute('data-src')).toBe(
    'https://app.hyperliquid.xyz/trade/BTC?isOneKeyBuiltInPerpView=true',
  );
  mockTarget = { coin: 'xyz:AAPL', revision: 2 };
  rerender(<WebviewPerpTradeWebView />);
  expect(screen.getByTestId('webview').getAttribute('data-src')).toBe(
    'https://app.hyperliquid.xyz/trade/xyz%3AAAPL?isOneKeyBuiltInPerpView=true',
  );
});

it('reloads a repeated target but preserves the webview on unrelated renders', () => {
  mockTarget = { coin: 'BTC', revision: 1 };
  const { rerender } = render(<WebviewPerpTradeWebView />);
  const original = screen.getByTestId('webview');
  rerender(<WebviewPerpTradeWebView />);
  expect(screen.getByTestId('webview')).toBe(original);
  mockTarget = { coin: 'BTC', revision: 2 };
  rerender(<WebviewPerpTradeWebView />);
  expect(screen.getByTestId('webview')).not.toBe(original);
  expect(screen.getByTestId('webview').getAttribute('data-src')).toContain(
    '/trade/BTC?',
  );
});

it('encodes the coin as a path segment without changing the origin or query', () => {
  mockTarget = { coin: 'xyz:A/B?x=1#frag', revision: 1 };
  render(<WebviewPerpTradeWebView />);
  const url = new URL(
    screen.getByTestId('webview').getAttribute('data-src') ?? '',
  );
  expect(url.origin).toBe('https://app.hyperliquid.xyz');
  expect(url.pathname).toBe('/trade/xyz%3AA%2FB%3Fx%3D1%23frag');
  expect(url.search).toBe('?isOneKeyBuiltInPerpView=true');
  expect(url.hash).toBe('');
});
