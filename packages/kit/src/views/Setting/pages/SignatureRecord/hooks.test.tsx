/** @jest-environment jsdom */

import { useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';

import { act, renderHook, waitFor } from '@testing-library/react';

import type { ISignatureItemQueryParams } from '@onekeyhq/shared/types/signatureRecord';

import { SignatureContext } from './Context';
import { useGetSignatureSections } from './hooks';

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => {
  const {
    useCallback,
    useEffect,
    useRef,
    useState: useMockState,
  } = jest.requireActual('react') as typeof import('react');
  return {
    usePromiseResult: <T,>(
      method: () => Promise<T>,
      deps: unknown[],
      options: { initResult: T },
    ) => {
      const [result, setResult] = useMockState(options.initResult);
      const [isLoading, setIsLoading] = useMockState(false);
      const methodRef = useRef(method);
      methodRef.current = method;
      const [networkId, limit, offset, address] = deps;
      const run = useCallback(async () => {
        setIsLoading(true);
        try {
          setResult(await methodRef.current());
        } finally {
          setIsLoading(false);
        }
      }, [setIsLoading, setResult]);
      useEffect(() => {
        void run();
      }, [networkId, limit, offset, address, run]);
      return { result, isLoading, run };
    },
  };
});

describe('useGetSignatureSections', () => {
  it('shows a retry state when the first page of a filter fails', async () => {
    const allNetworkId = 'onekeyall--0';
    const ethereumNetworkId = 'evm--1';
    const items = [{ createdAt: Date.now() }];
    let failEthereum = true;
    const method = jest.fn(({ networkId }: ISignatureItemQueryParams) => {
      if (networkId === ethereumNetworkId && failEthereum) {
        return Promise.reject(new Error('query failed'));
      }
      return Promise.resolve(items);
    });
    let setNetworkId: (networkId: string) => void = () => undefined;
    const Wrapper = ({ children }: PropsWithChildren) => {
      const [networkId, setSelectedNetworkId] = useState(allNetworkId);
      setNetworkId = setSelectedNetworkId;
      const value = useMemo(() => ({ networkId }), [networkId]);
      return (
        <SignatureContext.Provider value={value}>
          {children}
        </SignatureContext.Provider>
      );
    };
    const { result } = renderHook(() => useGetSignatureSections(method), {
      wrapper: Wrapper,
    });

    await waitFor(() =>
      expect(result.current.sections[0]?.data).toEqual(items),
    );
    act(() => setNetworkId(ethereumNetworkId));
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.hasError).toBe(true);
      expect(result.current.sections).toEqual([]);
    });

    failEthereum = false;
    act(() => result.current.onRetry());
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.hasError).toBe(false);
      expect(result.current.sections[0]?.data).toEqual(items);
    });
  });

  it('keeps a new filter loading until its records settle', async () => {
    const allNetworkId = 'onekeyall--0';
    const ethereumNetworkId = 'evm--1';
    const items = [{ createdAt: Date.now() }];
    let resolveEthereum: ((value: typeof items) => void) | undefined;
    const method = jest.fn(({ networkId }: ISignatureItemQueryParams) => {
      if (networkId === ethereumNetworkId) {
        return new Promise<typeof items>((resolve) => {
          resolveEthereum = resolve;
        });
      }
      return Promise.resolve(items);
    });
    let setNetworkId: (networkId: string) => void = () => undefined;
    const Wrapper = ({ children }: PropsWithChildren) => {
      const [networkId, setSelectedNetworkId] = useState(allNetworkId);
      setNetworkId = setSelectedNetworkId;
      const value = useMemo(() => ({ networkId }), [networkId]);
      return (
        <SignatureContext.Provider value={value}>
          {children}
        </SignatureContext.Provider>
      );
    };
    const { result } = renderHook(() => useGetSignatureSections(method), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.sections[0]?.data).toEqual(items);
    });

    act(() => setNetworkId(ethereumNetworkId));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.sections).toEqual([]);
    await waitFor(() => expect(resolveEthereum).toBeDefined());

    await act(async () => {
      resolveEthereum?.(items);
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.sections[0]?.data).toEqual(items);
  });

  it('starts at page zero when switching filters during a paginated request', async () => {
    const allNetworkId = 'onekeyall--0';
    const ethereumNetworkId = 'evm--1';
    const items = Array.from({ length: 10 }, (_, index) => ({
      createdAt: Date.now() - index,
    }));
    let resolveEthereumPage: ((value: typeof items) => void) | undefined;
    const method = jest.fn((params: ISignatureItemQueryParams) => {
      if (params.networkId === ethereumNetworkId && params.offset === 10) {
        return new Promise<typeof items>((resolve) => {
          resolveEthereumPage = resolve;
        });
      }
      return Promise.resolve(items);
    });
    let setNetworkId: (networkId: string) => void = () => undefined;
    const Wrapper = ({ children }: PropsWithChildren) => {
      const [networkId, setSelectedNetworkId] = useState(allNetworkId);
      setNetworkId = setSelectedNetworkId;
      const value = useMemo(() => ({ networkId }), [networkId]);
      return (
        <SignatureContext.Provider value={value}>
          {children}
        </SignatureContext.Provider>
      );
    };
    const { result } = renderHook(() => useGetSignatureSections(method), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.sections[0]?.data).toHaveLength(10);
    });
    act(() => setNetworkId(ethereumNetworkId));
    await waitFor(() => {
      expect(method).toHaveBeenCalledWith(
        expect.objectContaining({ networkId: ethereumNetworkId, offset: 0 }),
      );
      expect(result.current.sections[0]?.data).toHaveLength(10);
    });
    act(() => result.current.onEndReached());
    await waitFor(() => {
      expect(resolveEthereumPage).toBeDefined();
    });

    const callsBeforeReturningToAll = method.mock.calls.length;
    act(() => setNetworkId(allNetworkId));
    await waitFor(() => {
      expect(method.mock.calls.length).toBeGreaterThan(
        callsBeforeReturningToAll,
      );
    });
    expect(
      method.mock.calls
        .slice(callsBeforeReturningToAll)
        .filter(([params]) => params.networkId === allNetworkId)
        .map(([params]) => params.offset),
    ).toEqual([0]);

    await act(async () => {
      resolveEthereumPage?.(items);
    });
  });
});
