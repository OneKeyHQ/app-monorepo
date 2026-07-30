/* eslint-disable import/first */

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => {
  const getBorrowEModeStatus = jest.fn();
  (
    globalThis as unknown as {
      __borrowEModeServiceMock: jest.Mock;
    }
  ).__borrowEModeServiceMock = getBorrowEModeStatus;

  return {
    __esModule: true,
    default: {
      serviceStaking: {
        getBorrowEModeStatus,
      },
    },
  };
});

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => {
  type IMockResult = {
    scopeKey: string;
    eModeStatus: unknown;
    state: 'resolved' | 'error';
  } | null;
  const state: {
    current: {
      result: IMockResult;
      isLoading?: boolean;
      run: jest.Mock;
    };
    method?: () => Promise<IMockResult>;
  } = {
    current: {
      result: null,
      isLoading: undefined,
      run: jest.fn(),
    },
  };
  (
    globalThis as unknown as {
      __borrowEModePromiseResultMock: typeof state;
    }
  ).__borrowEModePromiseResultMock = state;

  return {
    usePromiseResult: (method: () => Promise<IMockResult>) => {
      state.method = method;
      return state.current;
    },
  };
});

import { renderHook } from '@testing-library/react-native';

import type { IBorrowEModeStatus } from '@onekeyhq/shared/types/staking';

import { useBorrowEModeStatus } from './useBorrowEModeStatus';

type IScopedResult = {
  scopeKey: string;
  eModeStatus: IBorrowEModeStatus | null;
  state: 'resolved' | 'error';
};

const promiseResultMock = (
  globalThis as unknown as {
    __borrowEModePromiseResultMock: {
      current: {
        result: IScopedResult | null;
        isLoading?: boolean;
        run: jest.Mock;
      };
      method?: () => Promise<IScopedResult>;
    };
  }
).__borrowEModePromiseResultMock;
const serviceMock = (
  globalThis as unknown as {
    __borrowEModeServiceMock: jest.Mock;
  }
).__borrowEModeServiceMock;

const eModeStatus: IBorrowEModeStatus = {
  eModeId: 1,
  originalLtv: '80',
  categories: [
    {
      eModeId: 1,
      label: 'Stablecoins',
      ltv: '93',
      disabled: false,
      assets: [],
    },
  ],
};

function getScopeKey({
  accountId = 'account-1',
  provider = 'aave',
}: {
  accountId?: string;
  provider?: string;
} = {}) {
  return JSON.stringify(['evm--1', provider, '0xMarket', accountId, true]);
}

type IEModeStatusHookProps = {
  nextAccountId: string;
  nextProvider: string;
};

function renderEModeStatus({
  accountId = 'account-1',
  provider = 'aave',
}: {
  accountId?: string;
  provider?: string;
} = {}) {
  return renderHook<
    ReturnType<typeof useBorrowEModeStatus>,
    IEModeStatusHookProps
  >(
    ({ nextAccountId, nextProvider }: IEModeStatusHookProps) =>
      useBorrowEModeStatus({
        networkId: 'evm--1',
        provider: nextProvider,
        marketAddress: '0xMarket',
        accountId: nextAccountId,
      }),
    {
      initialProps: {
        nextAccountId: accountId,
        nextProvider: provider,
      },
    },
  );
}

describe('useBorrowEModeStatus scope loading', () => {
  beforeEach(() => {
    promiseResultMock.current = {
      result: null,
      isLoading: undefined,
      run: jest.fn(),
    };
    promiseResultMock.method = undefined;
    serviceMock.mockReset();
  });

  it('marks an eligible unresolved scope pending before isLoading starts', () => {
    const { result } = renderEModeStatus();

    expect(result.current).toMatchObject({
      eModeStatus: null,
      isInitialLoading: true,
      isLoading: undefined,
    });
  });

  it('does not reuse a settled loading=false value for a new account scope', () => {
    promiseResultMock.current = {
      result: {
        scopeKey: getScopeKey(),
        eModeStatus,
        state: 'resolved',
      },
      isLoading: false,
      run: jest.fn(),
    };
    const view = renderEModeStatus();

    expect(view.result.current.isInitialLoading).toBe(false);

    view.rerender({
      nextAccountId: 'account-2',
      nextProvider: 'aave',
    });

    expect(view.result.current).toMatchObject({
      eModeStatus: null,
      isInitialLoading: true,
      isLoading: false,
    });
  });

  it('keeps the current status while that scope refreshes', () => {
    promiseResultMock.current = {
      result: {
        scopeKey: getScopeKey(),
        eModeStatus,
        state: 'resolved',
      },
      isLoading: true,
      run: jest.fn(),
    };

    const { result } = renderEModeStatus();

    expect(result.current).toMatchObject({
      eModeStatus,
      isInitialLoading: false,
      isLoading: true,
    });
  });

  it('does not expose initial loading for unsupported providers', () => {
    const { result } = renderEModeStatus({ provider: 'kamino' });

    expect(result.current).toMatchObject({
      eModeStatus: null,
      isInitialLoading: false,
    });
  });

  it('exposes a terminal initial error and preserves prior status on refresh errors', async () => {
    renderEModeStatus();
    serviceMock.mockRejectedValueOnce(new Error('initial request failed'));

    await expect(promiseResultMock.method?.()).resolves.toEqual({
      scopeKey: getScopeKey(),
      eModeStatus: null,
      state: 'error',
    });

    promiseResultMock.current = {
      result: {
        scopeKey: getScopeKey(),
        eModeStatus: null,
        state: 'error',
      },
      isLoading: false,
      run: jest.fn(),
    };
    const initialError = renderEModeStatus();

    expect(initialError.result.current).toMatchObject({
      eModeStatus: null,
      isError: true,
      isInitialLoading: false,
    });

    promiseResultMock.current = {
      result: {
        scopeKey: getScopeKey(),
        eModeStatus,
        state: 'resolved',
      },
      isLoading: false,
      run: jest.fn(),
    };
    renderEModeStatus();
    serviceMock.mockRejectedValueOnce(new Error('refresh failed'));

    await expect(promiseResultMock.method?.()).resolves.toEqual({
      scopeKey: getScopeKey(),
      eModeStatus,
      state: 'error',
    });
  });
});
