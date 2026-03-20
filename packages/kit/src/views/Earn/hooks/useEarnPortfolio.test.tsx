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

  (globalThis as any).__earnPortfolioVisibilityMock = state;

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

  (globalThis as any).__earnPortfolioFocusedMock = state;

  return {
    __esModule: true,
    useRouteIsFocused: () => state.isFocused,
  };
});

jest.mock('@onekeyhq/kit/src/views/Earn/hooks/earnPortfolioStream', () => {
  const streamEarnPortfolio = jest.fn();

  (globalThis as any).__earnPortfolioStreamMock = {
    streamEarnPortfolio,
  };

  return {
    __esModule: true,
    streamEarnPortfolio,
  };
});

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => {
  const state = {
    activeAccount: {
      account: {
        id: 'account-1',
        indexedAccountId: 'indexed-1',
      },
      indexedAccount: {
        id: 'indexed-1',
      },
    },
  };

  (globalThis as any).__earnPortfolioAccountMock = state;

  return {
    __esModule: true,
    useActiveAccount: () => state,
  };
});

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/earn', () => {
  const stateHolder = {
    state: {
      earnAccount: {},
    },
    portfolioCache: {},
  };

  const actions = {
    getEarnAccount: jest.fn(() => undefined),
    updateEarnAccounts: jest.fn(),
  };
  const actionsRef = {
    current: actions,
  };
  const setPortfolioCache = jest.fn();

  (globalThis as any).__earnPortfolioEarnMock = {
    actions,
    setPortfolioCache,
    stateHolder,
  };

  return {
    __esModule: true,
    useEarnActions: () => actionsRef,
    useEarnAtom: () => [stateHolder.state],
    useEarnPortfolioInvestmentsAtom: () => [
      stateHolder.portfolioCache,
      setPortfolioCache,
    ],
  };
});

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  __esModule: true,
  EAppEventBusNames: {
    AccountDataUpdate: 'AccountDataUpdate',
  },
  appEventBus: {
    off: jest.fn(),
    on: jest.fn(),
  },
}));

jest.mock('./useEarnAccountKey', () => ({
  __esModule: true,
  useEarnAccountKey: () => 'earn-account-key',
}));

import { act, renderHook, waitFor } from '@testing-library/react';

import { useEarnPortfolio } from './useEarnPortfolio';

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

const focusedMock = (globalThis as any).__earnPortfolioFocusedMock as {
  isFocused: boolean;
};
const visibilityMock = (globalThis as any).__earnPortfolioVisibilityMock as {
  isVisible: boolean;
  listeners: IVisibilityListener[];
};
const portfolioStreamMock = (globalThis as any).__earnPortfolioStreamMock as {
  streamEarnPortfolio: jest.Mock;
};
const earnMock = (globalThis as any).__earnPortfolioEarnMock as {
  actions: {
    getEarnAccount: jest.Mock;
    updateEarnAccounts: jest.Mock;
  };
  setPortfolioCache: jest.Mock;
  stateHolder: {
    portfolioCache: Record<string, unknown>;
    state: {
      earnAccount: Record<string, unknown>;
    };
  };
};

describe('useEarnPortfolio', () => {
  beforeEach(() => {
    focusedMock.isFocused = true;
    visibilityMock.isVisible = true;
    visibilityMock.listeners = [];

    earnMock.stateHolder.state = {
      earnAccount: {},
    };
    earnMock.stateHolder.portfolioCache = {};

    earnMock.actions.getEarnAccount.mockReset();
    earnMock.actions.getEarnAccount.mockReturnValue(undefined);
    earnMock.actions.updateEarnAccounts.mockReset();
    earnMock.setPortfolioCache.mockReset();
    portfolioStreamMock.streamEarnPortfolio.mockReset();
  });

  it('starts a fresh run immediately after refocus invalidates the previous in-flight stream', async () => {
    const firstRun = createDeferred<void>();
    const secondRun = createDeferred<void>();

    portfolioStreamMock.streamEarnPortfolio
      .mockReturnValueOnce(firstRun.promise)
      .mockReturnValueOnce(secondRun.promise);

    const { rerender, unmount } = renderHook(() => useEarnPortfolio(), {
      reactStrictMode: false,
    });

    await waitFor(() => {
      expect(portfolioStreamMock.streamEarnPortfolio).toHaveBeenCalledTimes(1);
    });

    act(() => {
      focusedMock.isFocused = false;
      rerender();
    });

    act(() => {
      focusedMock.isFocused = true;
      rerender();
    });

    await waitFor(() => {
      expect(portfolioStreamMock.streamEarnPortfolio).toHaveBeenCalledTimes(2);
    });

    unmount();

    await act(async () => {
      firstRun.resolve(undefined);
      secondRun.resolve(undefined);
      await Promise.all([firstRun.promise, secondRun.promise]);
    });
  });
});
