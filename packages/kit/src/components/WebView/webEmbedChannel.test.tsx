/** @jest-environment jsdom */

import { render } from '@testing-library/react';

import WebView from '@onekeyhq/kit/src/components/WebView';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { hasWebEmbedChannelMark } from '@onekeyhq/shared/src/utils/webEmbedChannelUtils';

import type {
  IJsBridgeMessagePayload,
  IJsBridgeReceiveHandler,
} from '@onekeyfe/cross-inpage-provider-types';

const mockBridgeReceiveHandler = jest.fn(
  async (_payload: IJsBridgeMessagePayload) => 'bg-result',
);
let mockReceiveHandler: IJsBridgeReceiveHandler | undefined;

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    bridgeReceiveHandler: (payload: IJsBridgeMessagePayload) =>
      mockBridgeReceiveHandler(payload),
  },
}));
jest.mock('@onekeyhq/components', () => ({
  Button: () => null,
  Stack: ({ children }: { children?: unknown }) => children ?? null,
}));
jest.mock('./InpageProviderWebView', () => ({
  __esModule: true,
  default: ({
    receiveHandler,
  }: {
    receiveHandler: IJsBridgeReceiveHandler;
  }) => {
    mockReceiveHandler = receiveHandler;
    return null;
  },
}));

const primeClose = {
  origin: 'null',
  scope: '$private',
  data: { method: 'webembedPrivateRequest_closeWebViewModal' },
} as unknown as IJsBridgeMessagePayload;

async function deliver(payload: IJsBridgeMessagePayload) {
  if (!mockReceiveHandler) throw new OneKeyLocalError('WebView did not mount');
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  return mockReceiveHandler(payload, {} as any);
}

beforeEach(() => {
  mockBridgeReceiveHandler.mockClear();
  mockReceiveHandler = undefined;
});

describe('WebView web-embed channel', () => {
  it('passes a Prime modal message to its handler and to the background unchanged', async () => {
    const customReceiveHandler = jest.fn();
    render(<WebView customReceiveHandler={customReceiveHandler} />);
    await expect(deliver(primeClose)).resolves.toBe('bg-result');
    expect(customReceiveHandler).toHaveBeenCalledWith(primeClose, {});
    expect(mockBridgeReceiveHandler).toHaveBeenCalledWith(primeClose);
    expect(mockBridgeReceiveHandler.mock.calls[0][0]).toBe(primeClose);
  });

  it('marks messages from the singleton web-embed page', async () => {
    render(<WebView isWebEmbedChannel />);
    await deliver(primeClose);
    const forwarded = mockBridgeReceiveHandler.mock.calls[0][0];
    expect(hasWebEmbedChannelMark(forwarded)).toBe(true);
    expect(forwarded.data).toBe(primeClose.data);
  });

  it('strips a mark a dApp page sends itself', async () => {
    render(<WebView src="https://dapp.example" />);
    await deliver({
      ...primeClose,
      $onekeyWebEmbedChannel: true,
    } as unknown as IJsBridgeMessagePayload);
    const forwarded = mockBridgeReceiveHandler.mock.calls[0][0];
    expect(hasWebEmbedChannelMark(forwarded)).toBe(false);
  });
});
