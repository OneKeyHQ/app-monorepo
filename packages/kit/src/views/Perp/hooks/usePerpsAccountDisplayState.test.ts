/* eslint-disable import/first */

import { renderHook } from '@testing-library/react-native';

const mockGetPerpsAccountDisplaySnapshotEntry = jest.fn<unknown, [unknown]>();

let mockDisplayReady = { statusReady: false };
let mockDisplaySnapshot = { entries: {} };
let mockPerpsAccountLoading = { selectAccountLoading: false };
let mockPerpsActiveAccount = {
  accountId: 'account-1' as string | null,
  indexedAccountId: null as string | null,
  accountAddress: '0xactive' as string | undefined,
  deriveType: 'default',
};
let mockPerpsAccountStatus = {
  accountNotSupport: false,
  canCreateAddress: false,
};
let mockSelectedWalletAccount = {
  ready: true,
  account: { id: 'account-1' } as { id: string } | undefined,
  indexedAccount: undefined as { id: string } | undefined,
  deriveType: 'default',
};

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({ activeAccount: mockSelectedWalletAccount }),
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  getPerpsAccountDisplaySnapshotEntry: (params: unknown) =>
    mockGetPerpsAccountDisplaySnapshotEntry(params),
  usePerpsAccountDisplayReadyAtom: () => [mockDisplayReady],
  usePerpsAccountDisplaySnapshotAtom: () => [mockDisplaySnapshot],
  usePerpsAccountLoadingInfoAtom: () => [mockPerpsAccountLoading],
  usePerpsActiveAccountAtom: () => [mockPerpsActiveAccount],
  usePerpsActiveAccountStatusAtom: () => [mockPerpsAccountStatus],
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isDesktop: false,
    isWeb: true,
  },
}));

import { usePerpsAccountDisplayState } from './usePerpsAccountDisplayState';

describe('usePerpsAccountDisplayState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDisplayReady = { statusReady: false };
    mockDisplaySnapshot = { entries: {} };
    mockPerpsAccountLoading = { selectAccountLoading: false };
    mockPerpsActiveAccount = {
      accountId: 'account-1',
      indexedAccountId: null,
      accountAddress: '0xactive',
      deriveType: 'default',
    };
    mockPerpsAccountStatus = {
      accountNotSupport: false,
      canCreateAddress: false,
    };
    mockSelectedWalletAccount = {
      ready: true,
      account: { id: 'account-1' },
      indexedAccount: undefined,
      deriveType: 'default',
    };
  });

  it('uses the selected wallet identity for the account snapshot lookup', () => {
    const snapshotEntry = {
      account: {
        accountAddress: '0xcached',
        accountId: 'account-1',
        indexedAccountId: null,
      },
    };
    mockGetPerpsAccountDisplaySnapshotEntry.mockReturnValue(snapshotEntry);

    const { result } = renderHook(() => usePerpsAccountDisplayState());

    expect(mockGetPerpsAccountDisplaySnapshotEntry).toHaveBeenCalledWith({
      snapshot: mockDisplaySnapshot,
      accountAddress: '0xactive',
      indexedAccountId: undefined,
      accountId: 'account-1',
      deriveType: 'default',
    });
    expect(result.current.snapshotEntry).toBe(snapshotEntry);
    expect(result.current.isLiveStatusPending).toBe(true);
    expect(result.current.shouldShowConnectWalletPrompt).toBe(false);
  });

  it('shows the connect-wallet prompt only after account selection resolves', () => {
    mockDisplayReady = { statusReady: true };
    mockPerpsActiveAccount = {
      ...mockPerpsActiveAccount,
      accountAddress: undefined,
    };
    mockGetPerpsAccountDisplaySnapshotEntry.mockReturnValue(undefined);

    const { result, rerender } = renderHook(() =>
      usePerpsAccountDisplayState(),
    );

    expect(result.current.shouldShowConnectWalletPrompt).toBe(true);

    mockPerpsAccountLoading = { selectAccountLoading: true };
    rerender({});

    expect(result.current.shouldShowConnectWalletPrompt).toBe(false);
  });
});
