/** @jest-environment jsdom */

import { useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';

import { act, renderHook, waitFor } from '@testing-library/react';

import type { ISignatureItemQueryParams } from '@onekeyhq/shared/types/signatureRecord';

import { SignatureContext } from './Context';
import { useGetSignatureSections } from './hooks';

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => {
  const {
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
      const methodRef = useRef(method);
      methodRef.current = method;
      const [networkId, limit, offset, address] = deps;
      useEffect(() => {
        void methodRef.current().then(setResult);
      }, [networkId, limit, offset, address, setResult]);
      return { result };
    },
  };
});

describe('useGetSignatureSections', () => {
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
