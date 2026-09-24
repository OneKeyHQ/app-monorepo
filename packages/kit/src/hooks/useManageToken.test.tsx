/**
 * @jest-environment jsdom
 */

import { renderHook } from '@testing-library/react';

import { useManageToken } from './useManageToken';

/*
yarn jest packages/kit/src/hooks/useManageToken.test.tsx
*/

const mockFetched: { current: unknown } = { current: undefined };

// The async settings lookup is modelled as "already resolved for some
// network": the hook must decide whether that result belongs to the network
// it is asked about now.
jest.mock('./usePromiseResult', () => ({
  usePromiseResult: () => ({ result: mockFetched.current, run: jest.fn() }),
}));

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pushModal: jest.fn() }),
}));

jest.mock('../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: { serviceNetwork: { getVaultSettings: jest.fn() } },
}));

const baseParams = {
  accountId: 'hd-1--m/44/60/0/0/0',
  walletId: 'hd-1',
  deriveType: 'default' as const,
};

describe('useManageToken', () => {
  // PR #13695 review: after a network switch without sync vault settings, the
  // async result still belongs to the previous network for the first render,
  // so the settings menu rendered the previous network's actions.
  it('ignores a fetched result that belongs to another network', () => {
    mockFetched.current = {
      networkId: 'evm--1',
      settings: { isSingleToken: false },
    };
    const { result } = renderHook(() =>
      useManageToken({ ...baseParams, networkId: 'evm--10' }),
    );
    expect(result.current.manageTokenEnabled).toBe(false);
  });

  it('uses the fetched result for the network it was fetched for', () => {
    mockFetched.current = {
      networkId: 'evm--10',
      settings: { isSingleToken: false },
    };
    const { result } = renderHook(() =>
      useManageToken({ ...baseParams, networkId: 'evm--10' }),
    );
    expect(result.current.manageTokenEnabled).toBe(true);
  });

  it('prefers the sync vault settings over the fetched ones', () => {
    mockFetched.current = {
      networkId: 'evm--10',
      settings: { isSingleToken: false },
    };
    const { result } = renderHook(() =>
      useManageToken({
        ...baseParams,
        networkId: 'evm--10',
        vaultSettings: { isSingleToken: true } as never,
      }),
    );
    expect(result.current.manageTokenEnabled).toBe(false);
  });
});
