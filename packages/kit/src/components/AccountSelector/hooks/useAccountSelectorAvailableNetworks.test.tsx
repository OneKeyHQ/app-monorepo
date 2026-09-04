/** @jest-environment jsdom */

import { renderHook } from '@testing-library/react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { useAccountSelectorAvailableNetworks } from './useAccountSelectorAvailableNetworks';

const mockGetAllNetworkIds: jest.MockedFunction<
  () => Promise<{ networkIds: string[] }>
> = jest.fn();
const mockRun = jest.fn();
const mockNetworkIds: string[] = [];
let capturedLoader: (() => Promise<string[]>) | undefined;

function isEventListener(value: unknown): value is () => void {
  return typeof value === 'function';
}

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: { AddedCustomNetwork: 'AddedCustomNetwork' },
  appEventBus: { off: jest.fn(), on: jest.fn() },
}));

const { appEventBus: mockAppEventBus } = jest.requireMock<{
  appEventBus: { off: jest.Mock; on: jest.Mock };
}>('@onekeyhq/shared/src/eventBus/appEventBus');

jest.mock('@onekeyhq/shared/src/logger/logger', () => {
  const noopLogger: unknown = new Proxy(jest.fn(), {
    apply: () => undefined,
    get: () => noopLogger,
  });
  return { defaultLogger: noopLogger };
});

jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceNetwork: {
      getAllNetworkIds: () => mockGetAllNetworkIds(),
    },
  },
}));

jest.mock('../../../hooks/usePromiseResult', () => ({
  usePromiseResult: (fn: () => Promise<string[]>) => {
    capturedLoader = fn;
    return { result: mockNetworkIds, run: mockRun };
  },
}));

jest.mock('../../../states/jotai/contexts/accountSelector', () => ({
  useAccountSelectorAvailableNetworksByNum: () => undefined,
  useAccountSelectorSceneInfo: () => ({ sceneName: 'home' }),
}));

jest.mock('../../../states/jotai/contexts/accountSelector/perfDebug', () => ({
  getAccountSelectorPerfTimestamp: () => 0,
  getNextAccountSelectorPerfOperationId: () => 1,
  isAccountSelectorPerfDebugEnabled: () => false,
}));

describe('useAccountSelectorAvailableNetworks all network ids cache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // The module level cache is shared across renders, so a single mount walks
  // through both the fresh window and the expiry in one sequence.
  it('serves a fresh cache and reloads once it outlives its max age', async () => {
    let now = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    mockGetAllNetworkIds.mockResolvedValue({ networkIds: ['evm--1'] });

    renderHook(() => useAccountSelectorAvailableNetworks({ num: 0 }));
    const loader = capturedLoader;
    if (!loader) {
      throw new OneKeyLocalError('network ids loader was not captured');
    }

    await loader();
    expect(mockGetAllNetworkIds).toHaveBeenCalledTimes(1);

    now += 60 * 1000;
    await loader();
    expect(mockGetAllNetworkIds).toHaveBeenCalledTimes(1);

    now += 5 * 60 * 1000;
    await loader();
    expect(mockGetAllNetworkIds).toHaveBeenCalledTimes(2);

    jest.restoreAllMocks();
  });

  it('keeps one listener and a stable result across parent rerenders', () => {
    const rendered = renderHook(() =>
      useAccountSelectorAvailableNetworks({ num: 0 }),
    );
    const initialResult = rendered.result.current;
    const listener: unknown = mockAppEventBus.on.mock.calls[0]?.[1];
    if (!isEventListener(listener)) {
      throw new OneKeyLocalError('network listener was not captured');
    }

    rendered.rerender();

    expect(rendered.result.current).toBe(initialResult);
    expect(mockAppEventBus.on).toHaveBeenCalledTimes(1);

    listener();
    expect(mockRun).toHaveBeenCalledTimes(1);
    expect(mockRun).toHaveBeenCalledWith({ alwaysSetState: true });

    rendered.unmount();
    expect(mockAppEventBus.off).toHaveBeenCalledTimes(1);
    expect(mockAppEventBus.off).toHaveBeenCalledWith(
      'AddedCustomNetwork',
      listener,
    );
  });
});
