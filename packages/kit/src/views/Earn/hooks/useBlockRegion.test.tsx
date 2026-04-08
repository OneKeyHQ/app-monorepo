/** @jest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';

import { useBlockRegion } from './useBlockRegion';

const mockGetBlockRegion = jest.fn<Promise<unknown>, []>();
const mockRefreshBlockRegion = jest.fn<Promise<unknown>, []>();
const mockUsePromiseResultRun = jest.fn<Promise<void>, [unknown?]>();

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return {
    promise,
    resolve,
    reject,
  };
}

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
      const requestIdRef = React.useRef(0);

      methodRef.current = method;

      const run = React.useCallback(async () => {
        const currentRequestId = requestIdRef.current + 1;
        requestIdRef.current = currentRequestId;
        setIsLoading(true);
        try {
          const nextResult = await methodRef.current();
          if (currentRequestId === requestIdRef.current) {
            setResult(nextResult);
          }
        } finally {
          if (currentRequestId === requestIdRef.current) {
            setIsLoading(false);
          }
        }
      }, []);
      const runWithSpy = React.useCallback(
        async (_config?: unknown) => {
          await run();
        },
        [run],
      );

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
    mockGetBlockRegion
      .mockResolvedValueOnce({ title: { text: 'Blocked' } })
      .mockResolvedValueOnce(null);
    mockRefreshBlockRegion.mockResolvedValue(undefined);

    const { result } = renderHook(() => useBlockRegion());

    await waitFor(() => {
      expect(mockGetBlockRegion).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await result.current.refreshBlockResult();
    });

    expect(mockRefreshBlockRegion).toHaveBeenCalledTimes(1);
    expect(mockGetBlockRegion).toHaveBeenCalledTimes(2);
    expect(result.current.blockResult).toEqual({ blockData: null });
  });

  it('keeps the latest lightweight block-region result when focus revalidation overlaps a manual refresh', async () => {
    const manualRefreshRequest = createDeferred<undefined>();
    const focusRevalidateRequest = createDeferred<{
      title: { text: string };
    } | null>();
    const postRefreshRequest = createDeferred<null>();

    mockGetBlockRegion
      .mockResolvedValueOnce({ title: { text: 'Blocked' } })
      .mockImplementationOnce(() => focusRevalidateRequest.promise)
      .mockImplementationOnce(() => postRefreshRequest.promise);
    mockRefreshBlockRegion.mockImplementation(
      () => manualRefreshRequest.promise,
    );

    const { result } = renderHook(() => useBlockRegion());

    await waitFor(() => {
      expect(mockGetBlockRegion).toHaveBeenCalledTimes(1);
      expect(result.current.blockResult).toEqual({
        blockData: { title: { text: 'Blocked' } },
      });
    });

    let refreshPromise: Promise<void> | undefined;
    act(() => {
      refreshPromise = result.current.refreshBlockResult();
    });

    let focusRunPromise: Promise<void> | undefined;
    act(() => {
      focusRunPromise = mockUsePromiseResultRun();
    });

    await act(async () => {
      manualRefreshRequest.resolve(undefined);
    });

    await act(async () => {
      postRefreshRequest.resolve(null);
      await refreshPromise;
    });

    await act(async () => {
      focusRevalidateRequest.resolve({ title: { text: 'Blocked' } });
      await focusRunPromise;
    });

    expect(mockRefreshBlockRegion).toHaveBeenCalledTimes(1);
    expect(mockGetBlockRegion).toHaveBeenCalledTimes(3);
    expect(result.current.blockResult).toEqual({ blockData: null });
  });
});
