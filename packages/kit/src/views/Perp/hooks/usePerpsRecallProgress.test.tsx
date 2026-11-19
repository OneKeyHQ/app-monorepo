/**
 * @jest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';

import type { IPerpsRecallProgress } from '@onekeyhq/shared/src/referralCode/recall';

import { usePerpsRecallProgress } from './usePerpsRecallProgress';

const mockFetch = jest
  .fn<Promise<IPerpsRecallProgress | null>, []>()
  .mockResolvedValue(null);
const mockDevSettings = {};
let mockLocale = 'en-US';
let mockAccount = {
  accountId: 'account-a',
  indexedAccountId: 'indexed-a',
  accountAddress: '0xaaa',
  deriveType: 'default',
};
let mockSnapshot: {
  instanceId: string;
  locale: string;
  progress: IPerpsRecallProgress | null;
};

jest.mock('react-intl', () => ({ useIntl: () => ({ locale: mockLocale }) }));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useSettingsPersistAtom: () => [{ instanceId: 'test-instance' }],
  useDevSettingsPersistAtom: () => [mockDevSettings],
  usePerpsActiveAccountAtom: () => [mockAccount],
  usePerpsRecallProgressAtom: () => [mockSnapshot],
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceReferralCode: { fetchPerpsRecallProgress: () => mockFetch() },
  },
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocusedWhenEnabled: () => true,
}));
jest.mock('@onekeyhq/components', () => ({
  getCurrentVisibilityState: () => true,
  onVisibilityStateChange: () => () => {},
  useNetInfo: () => ({ isRawInternetReachable: true }),
  useDeferredPromise: jest.requireActual<
    typeof import('@onekeyhq/components/src/hooks/useDeferredPromise')
  >('../../../../../components/src/hooks/useDeferredPromise')
    .useDeferredPromise,
}));

describe('recall account changes', () => {
  it('shares instance progress across accounts without refetching and hides it for watching accounts', async () => {
    const progress: IPerpsRecallProgress = {
      title: 'Trade more to earn 10 USDC',
      closable: true,
      reopenAfterMinutes: 30,
      blogUrl: 'https://onekey.so/blog/recall',
      activityId: 'recall-1',
      activityStatus: 'running',
      status: 'achieved',
      volume: '1000',
      totalReward: '10',
      earnedReward: '10',
      topTarget: '1000',
      current: null,
      deadline: '2030-01-01T00:00:00Z',
      payoutStatus: 'pending',
      paidAmount: null,
      paidAt: null,
    };
    mockSnapshot = {
      instanceId: 'test-instance',
      locale: 'en-us',
      progress,
    };
    const { result, rerender } = renderHook(() => usePerpsRecallProgress());
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    expect(result.current.progress).toEqual(progress);

    mockAccount = {
      ...mockAccount,
      accountId: 'account-b',
      accountAddress: '0xbbb',
    };
    await act(async () => rerender());
    expect(result.current.progress).toEqual(progress);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const ordinaryAccount = mockAccount;
    mockAccount = { ...mockAccount, accountId: 'watching--60--0xbbb' };
    await act(async () => rerender());
    expect(result.current.progress).toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(1);

    mockAccount = ordinaryAccount;
    await act(async () => rerender());
    expect(result.current.progress).toEqual(progress);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    mockLocale = 'zh-CN';
    await act(async () => rerender());
    expect(result.current.progress).toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(2);
    mockSnapshot = {
      ...mockSnapshot,
      locale: 'zh-cn',
      progress: { ...progress, title: '再交易，返奖励' },
    };
    await act(async () => rerender());
    expect(result.current.progress?.title).toBe('再交易，返奖励');

    mockSnapshot = { ...mockSnapshot, progress: null };
    await act(async () => rerender());
    expect(result.current.progress).toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
