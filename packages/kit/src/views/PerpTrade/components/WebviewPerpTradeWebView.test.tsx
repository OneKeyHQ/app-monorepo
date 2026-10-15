/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';

import ServiceWebviewPerp from '@onekeyhq/kit-bg/src/services/ServiceWebviewPerp/ServiceWebviewPerp';

import { WebviewPerpTradeWebView } from './WebviewPerpTradeWebView';

let mockTarget: {
  coin?: string;
  revision: number;
  pending?: { coin: string; requestId: string };
} = { revision: 0 };
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => {
  const actual = jest.requireActual<
    typeof import('@onekeyhq/kit-bg/src/states/jotai/atoms')
  >('@onekeyhq/kit-bg/src/states/jotai/atoms');
  return {
    ...actual,
    useWebviewPerpTradeTargetAtom: () => [mockTarget],
    webviewPerpTradeTargetAtom: {
      set: async (
        update: (previous: typeof mockTarget) => typeof mockTarget,
      ) => {
        mockTarget = update(mockTarget);
      },
    },
  };
});
jest.mock('p-timeout', () => ({
  __esModule: true,
  default: (promise: Promise<unknown>) => promise,
}));
jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () => (_target: unknown, _key: string, descriptor: unknown) =>
      descriptor,
  backgroundMethodForDev:
    () => (_target: unknown, _key: string, descriptor: unknown) =>
      descriptor,
  toastIfError: () => (_target: unknown, _key: string, descriptor: unknown) =>
    descriptor,
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

it('preserves the existing WebView and its market when preparation is cancelled', async () => {
  mockTarget = { coin: 'ETH', revision: 4 };
  const service = new ServiceWebviewPerp({ backgroundApi: {} });
  const { rerender } = render(<WebviewPerpTradeWebView />);
  const original = screen.getByTestId('webview');
  await service.setTradeTarget({ coin: 'BTC', requestId: 'cancelled' });
  rerender(<WebviewPerpTradeWebView />);
  expect(screen.getByTestId('webview')).toBe(original);
  expect(original.getAttribute('data-src')).toContain('/trade/ETH?');
  await service.clearTradeTarget({ requestId: 'cancelled' });
  rerender(<WebviewPerpTradeWebView />);
  expect(screen.getByTestId('webview')).toBe(original);
  expect(original.getAttribute('data-src')).toContain('/trade/ETH?');
});

it('updates an existing WebView only when navigation commits', async () => {
  mockTarget = { coin: 'ETH', revision: 4 };
  const service = new ServiceWebviewPerp({ backgroundApi: {} });
  const { rerender } = render(<WebviewPerpTradeWebView />);
  const original = screen.getByTestId('webview');
  await service.setTradeTarget({ coin: 'BTC', requestId: 'accepted' });
  rerender(<WebviewPerpTradeWebView />);
  expect(screen.getByTestId('webview')).toBe(original);
  await service.commitTradeTarget({ requestId: 'accepted' });
  rerender(<WebviewPerpTradeWebView />);
  expect(screen.getByTestId('webview')).not.toBe(original);
  expect(screen.getByTestId('webview').getAttribute('data-src')).toContain(
    '/trade/BTC?',
  );
});

it('waits on a cold mount and loads only the committed target', async () => {
  const service = new ServiceWebviewPerp({ backgroundApi: {} });
  await service.setTradeTarget({ coin: 'BTC', requestId: 'accepted' });
  const { rerender } = render(<WebviewPerpTradeWebView />);
  expect(screen.queryByTestId('webview')).toBeNull();
  await service.commitTradeTarget({ requestId: 'accepted' });
  rerender(<WebviewPerpTradeWebView />);
  expect(screen.getByTestId('webview').getAttribute('data-src')).toContain(
    '/trade/BTC?',
  );
});

it('loads the previous target if preparation is cancelled during a cold mount', async () => {
  const service = new ServiceWebviewPerp({ backgroundApi: {} });
  await service.setTradeTarget({ coin: 'BTC', requestId: 'cancelled' });
  const { rerender } = render(<WebviewPerpTradeWebView />);
  expect(screen.queryByTestId('webview')).toBeNull();
  await service.clearTradeTarget({ requestId: 'cancelled' });
  rerender(<WebviewPerpTradeWebView />);
  expect(screen.getByTestId('webview').getAttribute('data-src')).toBe(
    'https://app.hyperliquid.xyz/trade?isOneKeyBuiltInPerpView=true',
  );
});
