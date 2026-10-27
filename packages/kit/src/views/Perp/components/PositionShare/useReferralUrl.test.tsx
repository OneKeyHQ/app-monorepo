/** @jest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';

import { useReferralUrl } from './useReferralUrl';

const mockGetSummaryInfo = jest.fn<Promise<{ inviteCode: string }>, []>();
const mockGetMyReferralCode = jest.fn<
  Promise<string>,
  [{ onekeyUserId: string }]
>();
let mockUserId: string | undefined;

jest.mock('@onekeyhq/components', () => {
  const { useDeferredPromise } = jest.requireActual<
    typeof import('../../../../../../components/src/hooks/useDeferredPromise')
  >('../../../../../../components/src/hooks/useDeferredPromise');
  return {
    getCurrentVisibilityState: () => true,
    onVisibilityStateChange: () => () => {},
    useDeferredPromise,
    useNetInfo: () => ({ isRawInternetReachable: true }),
  };
});

jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocusedWhenEnabled: () => true,
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceReferralCode: {
      getSummaryInfo: () => mockGetSummaryInfo(),
      getMyReferralCode: (params: { onekeyUserId: string }) =>
        mockGetMyReferralCode(params),
    },
  },
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePrimePersistAtom: () => [
    {
      isLoggedIn: Boolean(mockUserId),
      isLoggedInOnServer: Boolean(mockUserId),
      onekeyUserId: mockUserId,
    },
  ],
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings', () => ({
  useDevSettingsPersistAtom: () => [{ enabled: false }],
}));

describe('useReferralUrl account isolation', () => {
  beforeEach(() => {
    mockGetSummaryInfo.mockReset();
    mockGetMyReferralCode.mockReset().mockResolvedValue('');
    mockUserId = undefined;
  });

  it('uses a default link when signed out without reading a legacy cache', async () => {
    const { result } = renderHook(() => useReferralUrl());

    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current.referralQrCodeUrl).toBe(
      'https://app.onekey.so/perps',
    );
    expect(mockGetMyReferralCode).not.toHaveBeenCalled();
    expect(mockGetSummaryInfo).not.toHaveBeenCalled();
  });

  it('asks for only the visible account cache when the summary fails', async () => {
    mockUserId = 'OFFLINE-B';
    mockGetSummaryInfo.mockRejectedValue(new Error('Offline'));
    const { result } = renderHook(() => useReferralUrl());

    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(mockGetMyReferralCode).toHaveBeenCalledWith({
      onekeyUserId: 'OFFLINE-B',
    });
    expect(result.current.referralQrCodeUrl).toBe(
      'https://app.onekey.so/perps',
    );
  });

  it('hides an old account result while the new account request is pending', async () => {
    mockUserId = 'LOADED-A';
    mockGetSummaryInfo.mockResolvedValueOnce({ inviteCode: 'CODE-A' });
    const { result, rerender } = renderHook(() => useReferralUrl());
    await waitFor(() =>
      expect(result.current.referralDisplayText).toBe('CODE-A'),
    );

    mockUserId = 'PENDING-B';
    mockGetSummaryInfo.mockReturnValueOnce(new Promise(() => {}));
    rerender();

    expect(result.current.referralQrCodeUrl).toBe(
      'https://app.onekey.so/perps',
    );
    expect(result.current.referralDisplayText).not.toBe('CODE-A');
  });

  it('does not restore a previous account response after switching accounts', async () => {
    mockUserId = 'PENDING-A';
    let resolvePrevious!: (value: { inviteCode: string }) => void;
    mockGetSummaryInfo.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePrevious = resolve;
      }),
    );
    const { result, rerender } = renderHook(() => useReferralUrl('swap'));
    mockUserId = 'LOADED-B';
    mockGetSummaryInfo.mockResolvedValueOnce({ inviteCode: 'CODE-B' });
    rerender();
    await waitFor(() =>
      expect(result.current.referralDisplayText).toBe('CODE-B'),
    );

    await act(async () => resolvePrevious({ inviteCode: 'CODE-A' }));

    expect(result.current.referralQrCodeUrl).toBe(
      'https://app.onekey.so/r/CODE-B/app/swap',
    );
  });
});
