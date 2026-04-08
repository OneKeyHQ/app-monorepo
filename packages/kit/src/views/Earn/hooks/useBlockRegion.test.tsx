/** @jest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';

import { useBlockRegion } from './useBlockRegion';

const mockGetBlockRegion = jest.fn<Promise<unknown>, []>();
const mockRefreshBlockRegion = jest.fn<Promise<unknown>, []>();
const mockUsePromiseResultRun = jest.fn<Promise<void>, []>();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceStaking: {
      getBlockRegion: () => mockGetBlockRegion(),
      refreshBlockRegion: () => mockRefreshBlockRegion(),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  return {
    usePromiseResult: (method: () => Promise<unknown>) => {
      const methodRef = React.useRef(method);
      const [result, setResult] = React.useState<unknown>(undefined);
      const [isLoading, setIsLoading] = React.useState(false);

      methodRef.current = method;

      const run = React.useCallback(async () => {
        setIsLoading(true);
        try {
          const nextResult = await methodRef.current();
          setResult(nextResult);
        } finally {
          setIsLoading(false);
        }
      }, []);
      const runWithSpy = React.useCallback(async () => {
        await run();
      }, [run]);

      React.useEffect(() => {
        void runWithSpy();
      }, [runWithSpy]);

      mockUsePromiseResultRun.mockImplementation(runWithSpy);

      return {
        isLoading,
        result,
        run: runWithSpy,
        setResult,
      };
    },
  };
});

describe('useBlockRegion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePromiseResultRun.mockReset();
  });

  it('loads block-region state through the lightweight query by default', async () => {
    mockGetBlockRegion.mockResolvedValue({ title: { text: 'Blocked' } });

    renderHook(() => useBlockRegion());

    await waitFor(() => {
      expect(mockGetBlockRegion).toHaveBeenCalledTimes(1);
    });

    expect(mockRefreshBlockRegion).not.toHaveBeenCalled();
  });

  it('re-runs connection selection before refreshing block-region state', async () => {
    mockGetBlockRegion.mockResolvedValue({ title: { text: 'Blocked' } });
    mockRefreshBlockRegion.mockResolvedValue(null);

    const { result } = renderHook(() => useBlockRegion());

    await waitFor(() => {
      expect(mockGetBlockRegion).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await result.current.refreshBlockResult();
    });

    expect(mockRefreshBlockRegion).toHaveBeenCalledTimes(1);
    expect(mockGetBlockRegion).toHaveBeenCalledTimes(1);
    expect(result.current.blockResult).toEqual({ blockData: null });
  });

  it('keeps focus revalidation on the lightweight query during a manual refresh', async () => {
    let resolveRefresh: ((value: unknown) => void) | undefined;
    mockGetBlockRegion.mockResolvedValue({ title: { text: 'Blocked' } });
    mockRefreshBlockRegion.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRefresh = resolve;
        }),
    );

    const { result } = renderHook(() => useBlockRegion());

    await waitFor(() => {
      expect(mockGetBlockRegion).toHaveBeenCalledTimes(1);
    });

    let refreshPromise: Promise<void> | undefined;
    await act(async () => {
      refreshPromise = result.current.refreshBlockResult();
    });

    await act(async () => {
      await mockUsePromiseResultRun();
    });

    expect(mockRefreshBlockRegion).toHaveBeenCalledTimes(1);
    expect(mockGetBlockRegion).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolveRefresh?.(null);
      await refreshPromise;
    });
  });
});
