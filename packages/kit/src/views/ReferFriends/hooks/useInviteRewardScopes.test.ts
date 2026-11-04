/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import type { IInviteRewardScope } from '@onekeyhq/shared/src/referralCode/type';

import {
  resetInviteRewardScopesCacheForTest,
  useInviteRewardScopes,
} from './useInviteRewardScopes';

const mockGetInviteRewardScopes = jest.fn<Promise<IInviteRewardScope[]>, []>();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceReferralCode: {
      getInviteRewardScopes: () => mockGetInviteRewardScopes(),
    },
  },
}));

const SCOPES = [
  { subject: 'Swap', description: 'Swap providers' },
  { subject: 'Earn', description: 'DeFi venues' },
];

describe('useInviteRewardScopes', () => {
  beforeEach(() => {
    mockGetInviteRewardScopes.mockReset();
    resetInviteRewardScopesCacheForTest();
  });

  it('starts empty and shows the server scopes once they arrive', async () => {
    mockGetInviteRewardScopes.mockResolvedValue(SCOPES);
    const { result } = renderHook(() => useInviteRewardScopes());

    expect(result.current).toEqual([]);
    await act(async () => {});
    expect(result.current).toEqual(SCOPES);
  });

  it('shares one request between tabs mounted together', async () => {
    mockGetInviteRewardScopes.mockResolvedValue(SCOPES);
    const first = renderHook(() => useInviteRewardScopes());
    const second = renderHook(() => useInviteRewardScopes());
    await act(async () => {});

    expect(mockGetInviteRewardScopes).toHaveBeenCalledTimes(1);
    expect(first.result.current).toEqual(SCOPES);
    expect(second.result.current).toEqual(SCOPES);
  });

  it('paints the last answer on a later mount while it refreshes', async () => {
    mockGetInviteRewardScopes.mockResolvedValue(SCOPES);
    const first = renderHook(() => useInviteRewardScopes());
    await act(async () => {});
    first.unmount();

    mockGetInviteRewardScopes.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useInviteRewardScopes());
    expect(result.current).toEqual(SCOPES);
  });

  it('stays empty when the request fails', async () => {
    mockGetInviteRewardScopes.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useInviteRewardScopes());
    await act(async () => {});

    expect(result.current).toEqual([]);
  });
});
