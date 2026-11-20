/** @jest-environment jsdom */
import { act, renderHook, waitFor } from '@testing-library/react';

import { useEarnFunding } from './earnFundingRegistry';

const mockRead = jest.fn<Promise<null>, [string]>(async () => null);
let onMessage: (() => void) | undefined;
const mockClose = jest.fn();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceStaking: { getEarnFunding: (scope: string) => mockRead(scope) },
  },
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isWeb: true },
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: { EarnFundingChanged: 'EarnFundingChanged' },
  appEventBus: { on: jest.fn(), off: jest.fn() },
}));

const previous = globalThis.BroadcastChannel;
beforeEach(() => {
  mockRead.mockClear();
  mockClose.mockClear();
  onMessage = undefined;
  class Channel {
    addEventListener(_type: string, listener: () => void) {
      onMessage = listener;
    }
    postMessage() {}
    close() {
      mockClose();
    }
  }
  Object.defineProperty(globalThis, 'BroadcastChannel', {
    configurable: true,
    value: Channel,
  });
});
afterEach(() => {
  Object.defineProperty(globalThis, 'BroadcastChannel', {
    configurable: true,
    value: previous,
  });
});

it('refreshes persisted funding when another tab broadcasts a change or the window regains focus', async () => {
  const previousAdd = globalThis.addEventListener;
  let focusListener: EventListener | undefined;
  Object.defineProperty(globalThis, 'addEventListener', {
    configurable: true,
    value: (
      event: string,
      listener: EventListenerOrEventListenerObject | null,
    ) => {
      if (event === 'focus' && typeof listener === 'function')
        focusListener = listener;
    },
  });
  const view = renderHook(() => useEarnFunding('scope'));
  await waitFor(() => expect(mockRead).toHaveBeenCalledTimes(1));
  await act(async () => {
    onMessage?.();
  });
  await waitFor(() => expect(mockRead).toHaveBeenCalledTimes(2));
  expect(typeof focusListener).toBe('function');
  await act(async () => {
    if (typeof focusListener === 'function')
      focusListener.call(globalThis, new Event('focus'));
  });
  await waitFor(() => expect(mockRead).toHaveBeenCalledTimes(3));
  view.unmount();
  expect(mockClose).toHaveBeenCalledTimes(1);
  Object.defineProperty(globalThis, 'addEventListener', {
    configurable: true,
    value: previousAdd,
  });
});
