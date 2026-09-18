/* eslint-disable import/first */

const mockSetMap = jest.fn();
jest.mock('../utils', () => ({
  __esModule: true,
  globalAtom: () => ({
    target: {},
    use: () => [{}, mockSetMap],
  }),
}));

import { renderHook } from '@testing-library/react-native';

import {
  EJotaiContextStoreNames,
  getJotaiContextTrackerMap,
  useJotaiContextTrackerMap,
} from './jotaiContextStoreMap';

import type { IJotaiContextStoreMap } from './jotaiContextStoreMap';

function buildMap(...storeIds: string[]): IJotaiContextStoreMap {
  return Object.fromEntries(
    storeIds.map((storeId) => [
      storeId,
      { storeName: EJotaiContextStoreNames.swap, count: 1 },
    ]),
  );
}

const flushMicrotasks = () => Promise.resolve().then(() => undefined);

describe('jotaiContextStoreMap', () => {
  it('includes the market swap review store name', () => {
    expect(EJotaiContextStoreNames.marketSwapReview).toBe('marketSwapReview');
    expect(EJotaiContextStoreNames.marketSwap).toBe('marketSwap');
  });
});

describe('useJotaiContextTrackerMap', () => {
  beforeEach(() => {
    mockSetMap.mockClear();
  });

  it('exposes every update to same-runtime readers at once', () => {
    const { result } = renderHook(() => useJotaiContextTrackerMap());

    result.current.setMap(buildMap('sync-1'));
    expect(getJotaiContextTrackerMap()).toEqual(buildMap('sync-1'));

    result.current.setMap(buildMap('sync-1', 'sync-2'));
    expect(getJotaiContextTrackerMap()).toEqual(buildMap('sync-1', 'sync-2'));
  });

  it('writes the atom once per batch, with the final map', async () => {
    const { result } = renderHook(() => useJotaiContextTrackerMap());

    result.current.setMap(buildMap('batch-1'));
    result.current.setMap(buildMap('batch-1', 'batch-2'));
    result.current.setMap(buildMap('batch-1', 'batch-2', 'batch-3'));
    expect(mockSetMap).not.toHaveBeenCalled();

    await flushMicrotasks();

    expect(mockSetMap).toHaveBeenCalledTimes(1);
    expect(mockSetMap).toHaveBeenCalledWith(
      buildMap('batch-1', 'batch-2', 'batch-3'),
    );
  });

  it('writes nothing when a provider mounts and unmounts within one batch', async () => {
    const { result } = renderHook(() => useJotaiContextTrackerMap());

    result.current.setMap(buildMap('kept'));
    await flushMicrotasks();
    mockSetMap.mockClear();

    result.current.setMap(buildMap('kept', 'transient'));
    result.current.setMap(buildMap('kept'));
    await flushMicrotasks();

    expect(mockSetMap).not.toHaveBeenCalled();
    expect(getJotaiContextTrackerMap()).toEqual(buildMap('kept'));
  });

  it('writes again for the next batch', async () => {
    const { result } = renderHook(() => useJotaiContextTrackerMap());

    result.current.setMap(buildMap('next-1'));
    await flushMicrotasks();
    mockSetMap.mockClear();

    result.current.setMap(buildMap('next-1', 'next-2'));
    await flushMicrotasks();

    expect(mockSetMap).toHaveBeenCalledTimes(1);
    expect(mockSetMap).toHaveBeenCalledWith(buildMap('next-1', 'next-2'));
  });

  it('flushes a batch through a setter that is still mounted', async () => {
    const first = renderHook(() => useJotaiContextTrackerMap());
    const second = renderHook(() => useJotaiContextTrackerMap());

    first.result.current.setMap(buildMap('owner-1'));
    second.result.current.setMap(buildMap('owner-1', 'owner-2'));
    first.unmount();
    await flushMicrotasks();

    expect(mockSetMap).toHaveBeenCalledTimes(1);
    expect(mockSetMap).toHaveBeenCalledWith(buildMap('owner-1', 'owner-2'));

    second.unmount();
  });
});
