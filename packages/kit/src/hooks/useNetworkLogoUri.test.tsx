/** @jest-environment jsdom */

import { beforeEach, expect, jest, test } from '@jest/globals';
import { renderHook } from '@testing-library/react';

const mockGetNetworkSafe = jest.fn(
  async (_params: unknown): Promise<{ logoURI: string }> => ({
    logoURI: 'fixture-remote-logo',
  }),
);
const mockLoaders: Array<() => Promise<unknown>> = [];
jest.mock('../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceNetwork: {
      getNetworkSafe: (params: unknown): Promise<{ logoURI: string }> =>
        mockGetNetworkSafe(params),
    },
  },
}));
jest.mock('./usePromiseResult', () => ({
  usePromiseResult: (
    method: () => Promise<unknown>,
    _deps: unknown,
    options?: { initResult?: unknown },
  ) => {
    mockLoaders.push(method);
    return { result: options?.initResult };
  },
}));
jest.mock('@onekeyhq/shared/src/utils/cacheUtils', () => ({
  memoizee: <T,>(method: T) => method,
}));
jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  __esModule: true,
  default: {
    getLocalNetworkInfo: (networkId: string) =>
      networkId === 'evm--1' ? { logoURI: 'fixture-preset-logo' } : undefined,
  },
}));

// Imported Jest bindings do not hoist mocks in the SWC transform.
const { useNetworkLogoUri } = jest.requireActual<
  typeof import('./useNetworkLogoUri')
>('./useNetworkLogoUri');

beforeEach(() => {
  mockLoaders.length = 0;
  mockGetNetworkSafe.mockClear();
});

test('suppresses missing-logo RPC when the scoped host owns network resolution', async () => {
  const view = renderHook(() =>
    useNetworkLogoUri({ networkId: 'custom--fixture', skipFetch: true }),
  );
  expect(view.result.current).toBe('');
  await Promise.all(mockLoaders.map((method) => method()));
  expect(mockGetNetworkSafe).not.toHaveBeenCalled();
});

test('retains preset and supplied batch logos when fallback RPC is disabled', async () => {
  const view = renderHook((props) => useNetworkLogoUri(props), {
    initialProps: {
      networkId: 'evm--1',
      logoUri: undefined as string | undefined,
      skipFetch: true,
    },
  });
  expect(view.result.current).toBe('fixture-preset-logo');
  view.rerender({
    networkId: 'custom--fixture',
    logoUri: 'fixture-batch-logo',
    skipFetch: true,
  });
  expect(view.result.current).toBe('fixture-batch-logo');
  await Promise.all(mockLoaders.map((method) => method()));
  expect(mockGetNetworkSafe).not.toHaveBeenCalled();
});

test('retains missing-logo lookup when the caller does not opt out', async () => {
  renderHook(() => useNetworkLogoUri({ networkId: 'custom--fixture' }));
  expect(await mockLoaders[0]()).toEqual({
    networkId: 'custom--fixture',
    logoUri: 'fixture-remote-logo',
  });
  expect(mockGetNetworkSafe).toHaveBeenCalledWith({
    networkId: 'custom--fixture',
  });
});
