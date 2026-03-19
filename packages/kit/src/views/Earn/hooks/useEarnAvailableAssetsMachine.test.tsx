/**
 * @jest-environment jsdom
 */
/* eslint-disable import/first */

type IVisibilityListener = (visible: boolean) => void;

jest.mock('@onekeyhq/components', () => {
  const state = {
    isVisible: true,
    listeners: [] as IVisibilityListener[],
  };

  (globalThis as any).__earnAvailableAssetsVisibilityMock = state;

  return {
    __esModule: true,
    getCurrentVisibilityState: () => state.isVisible,
    onVisibilityStateChange: (listener: IVisibilityListener) => {
      state.listeners.push(listener);
      return () => {
        state.listeners = state.listeners.filter((item) => item !== listener);
      };
    },
  };
});

jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => {
  const state = {
    isFocused: true,
  };

  (globalThis as any).__earnAvailableAssetsFocusedMock = state;

  return {
    __esModule: true,
    useRouteIsFocused: () => state.isFocused,
  };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => {
  const serviceStaking = {
    getAvailableAssets: jest.fn(),
  };

  (globalThis as any).__earnAvailableAssetsBackgroundMock = {
    serviceStaking,
  };

  return {
    __esModule: true,
    default: {
      serviceStaking,
    },
  };
});

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/earn', () => {
  const stateHolder = {
    state: {
      availableAssetsByType: {},
      refreshTrigger: 0,
      isMounted: true,
    },
  };

  const actions = {
    setLoadingState: jest.fn(),
    updateAvailableAssetsByType: jest.fn(),
  };
  const actionsRef = {
    current: actions,
  };

  (globalThis as any).__earnAvailableAssetsEarnMock = {
    actions,
    stateHolder,
  };

  return {
    __esModule: true,
    useEarnAtom: () => [stateHolder.state],
    useEarnActions: () => actionsRef,
  };
});

import { act, renderHook, waitFor } from '@testing-library/react';

import { EAvailableAssetsTypeEnum } from '@onekeyhq/shared/types/earn';

import { useEarnAvailableAssetsMachine } from './useEarnAvailableAssetsMachine';

type IDeferred<T> = {
  promise: Promise<T>;
  reject: (reason?: unknown) => void;
  resolve: (value: T) => void;
};

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, reject, resolve } satisfies IDeferred<T>;
}

const visibilityMock = (globalThis as any)
  .__earnAvailableAssetsVisibilityMock as {
  isVisible: boolean;
  listeners: IVisibilityListener[];
};
const focusedMock = ((globalThis as any).__earnAvailableAssetsFocusedMock ??=
  {}) as {
  isFocused: boolean;
};
const backgroundMock = (globalThis as any)
  .__earnAvailableAssetsBackgroundMock as {
  serviceStaking: {
    getAvailableAssets: jest.Mock;
  };
};
const earnMock = (globalThis as any).__earnAvailableAssetsEarnMock as {
  actions: {
    setLoadingState: jest.Mock;
    updateAvailableAssetsByType: jest.Mock;
  };
  stateHolder: {
    state: {
      availableAssetsByType: Partial<
        Record<EAvailableAssetsTypeEnum, Array<{ symbol: string }>>
      >;
      isMounted: boolean;
      refreshTrigger: number;
    };
  };
};

function emitVisibility(visible: boolean) {
  visibilityMock.isVisible = visible;
  for (const listener of visibilityMock.listeners) {
    listener(visible);
  }
}

describe('useEarnAvailableAssetsMachine', () => {
  beforeEach(() => {
    focusedMock.isFocused = true;
    visibilityMock.isVisible = true;
    visibilityMock.listeners = [];

    earnMock.stateHolder.state = {
      availableAssetsByType: {},
      refreshTrigger: 0,
      isMounted: true,
    };

    earnMock.actions.setLoadingState.mockReset();
    earnMock.actions.updateAvailableAssetsByType.mockReset();
    earnMock.actions.updateAvailableAssetsByType.mockImplementation(
      (tabType, assets) => {
        earnMock.stateHolder.state = {
          ...earnMock.stateHolder.state,
          availableAssetsByType: {
            ...earnMock.stateHolder.state.availableAssetsByType,
            [tabType]: assets,
          },
        };
      },
    );

    backgroundMock.serviceStaking.getAvailableAssets.mockReset();
  });

  it('does not let stale same-tab responses overwrite the shared cache', async () => {
    const firstRequest = createDeferred<Array<{ symbol: string }>>();
    const secondRequest = createDeferred<Array<{ symbol: string }>>();

    backgroundMock.serviceStaking.getAvailableAssets
      .mockReturnValueOnce(firstRequest.promise)
      .mockReturnValueOnce(secondRequest.promise);

    const { rerender } = renderHook(
      () =>
        useEarnAvailableAssetsMachine({
          tabType: EAvailableAssetsTypeEnum.SimpleEarn,
        }),
      {
        reactStrictMode: false,
      },
    );

    await waitFor(() => {
      expect(
        backgroundMock.serviceStaking.getAvailableAssets,
      ).toHaveBeenCalledTimes(1);
    });

    earnMock.stateHolder.state = {
      ...earnMock.stateHolder.state,
      refreshTrigger: 1,
    };

    rerender();

    await waitFor(() => {
      expect(
        backgroundMock.serviceStaking.getAvailableAssets,
      ).toHaveBeenCalledTimes(2);
    });

    await act(async () => {
      secondRequest.resolve([{ symbol: 'NEW' }]);
      await secondRequest.promise;
    });

    expect(earnMock.actions.updateAvailableAssetsByType).toHaveBeenCalledTimes(
      1,
    );
    expect(
      earnMock.actions.updateAvailableAssetsByType,
    ).toHaveBeenLastCalledWith(EAvailableAssetsTypeEnum.SimpleEarn, [
      { symbol: 'NEW' },
    ]);

    await act(async () => {
      firstRequest.resolve([{ symbol: 'OLD' }]);
      await firstRequest.promise;
    });

    expect(earnMock.actions.updateAvailableAssetsByType).toHaveBeenCalledTimes(
      1,
    );
    expect(earnMock.stateHolder.state.availableAssetsByType).toEqual({
      [EAvailableAssetsTypeEnum.SimpleEarn]: [{ symbol: 'NEW' }],
    });
  });

  it('follows same-tab shared cache updates immediately', async () => {
    focusedMock.isFocused = false;

    const { result, rerender } = renderHook(
      () =>
        useEarnAvailableAssetsMachine({
          tabType: EAvailableAssetsTypeEnum.SimpleEarn,
        }),
      {
        reactStrictMode: false,
      },
    );

    expect(result.current.assets).toEqual([]);

    act(() => {
      earnMock.actions.updateAvailableAssetsByType(
        EAvailableAssetsTypeEnum.SimpleEarn,
        [{ symbol: 'ETH' }],
      );
    });

    rerender();

    expect(result.current.assets).toEqual([{ symbol: 'ETH' }]);
  });

  it('defers refresh while hidden and re-fetches after becoming visible again', async () => {
    emitVisibility(false);
    backgroundMock.serviceStaking.getAvailableAssets.mockResolvedValue([
      { symbol: 'ETH' },
    ]);

    const { rerender } = renderHook(
      () =>
        useEarnAvailableAssetsMachine({
          tabType: EAvailableAssetsTypeEnum.SimpleEarn,
        }),
      {
        reactStrictMode: false,
      },
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(
      backgroundMock.serviceStaking.getAvailableAssets,
    ).not.toHaveBeenCalled();

    act(() => {
      earnMock.stateHolder.state = {
        ...earnMock.stateHolder.state,
        refreshTrigger: 1,
      };
    });

    rerender();

    await act(async () => {
      await Promise.resolve();
    });

    expect(
      backgroundMock.serviceStaking.getAvailableAssets,
    ).not.toHaveBeenCalled();

    await act(async () => {
      emitVisibility(true);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(
        backgroundMock.serviceStaking.getAvailableAssets,
      ).toHaveBeenCalledTimes(1);
    });
  });

  it('cleans loading flags when switching tabs and on unmount', async () => {
    const firstRequest = createDeferred<Array<{ symbol: string }>>();
    const secondRequest = createDeferred<Array<{ symbol: string }>>();

    backgroundMock.serviceStaking.getAvailableAssets
      .mockReturnValueOnce(firstRequest.promise)
      .mockReturnValueOnce(secondRequest.promise);

    const { rerender, unmount } = renderHook(
      ({ tabType }: { tabType: EAvailableAssetsTypeEnum }) =>
        useEarnAvailableAssetsMachine({
          tabType,
        }),
      {
        initialProps: {
          tabType: EAvailableAssetsTypeEnum.SimpleEarn,
        },
        reactStrictMode: false,
      },
    );

    await waitFor(() => {
      expect(earnMock.actions.setLoadingState).toHaveBeenCalledWith(
        `availableAssets-${EAvailableAssetsTypeEnum.SimpleEarn}`,
        true,
      );
    });

    rerender({
      tabType: EAvailableAssetsTypeEnum.FixedRate,
    });

    await waitFor(() => {
      expect(earnMock.actions.setLoadingState).toHaveBeenCalledWith(
        `availableAssets-${EAvailableAssetsTypeEnum.SimpleEarn}`,
        false,
      );
      expect(earnMock.actions.setLoadingState).toHaveBeenCalledWith(
        `availableAssets-${EAvailableAssetsTypeEnum.FixedRate}`,
        true,
      );
    });

    unmount();

    expect(earnMock.actions.setLoadingState).toHaveBeenCalledWith(
      `availableAssets-${EAvailableAssetsTypeEnum.FixedRate}`,
      false,
    );

    await act(async () => {
      firstRequest.resolve([{ symbol: 'OLD' }]);
      secondRequest.resolve([{ symbol: 'NEW' }]);
      await Promise.all([firstRequest.promise, secondRequest.promise]);
    });
  });
});
