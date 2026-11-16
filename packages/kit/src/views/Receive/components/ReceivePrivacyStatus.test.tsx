/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { Provider, atom, createStore } from 'jotai';

import type { IPrivacyChainScanState } from '@onekeyhq/kit-bg/src/states/jotai/atoms/privacyChain';
import type { ILocalWalletSyncProgress } from '@onekeyhq/kit-bg/src/vaults/localWallet/types';
import { PRIVACY_CHAIN_SYNC_POLL_MS } from '@onekeyhq/shared/src/utils/privacyChainSyncPolicy';

import { ReceivePrivacySyncStatus } from './ReceivePrivacyStatus';

const initialState: IPrivacyChainScanState = {
  progress: {},
  boostingNetworkIds: [],
  dataBlockedNetworkIds: [],
  pausedNetworkIds: [],
  preparingAccountKeys: [],
  storageUnsupportedNetworkIds: [],
  syncErrorByNetworkId: {},
};
const mockPrivacyChainAtom = atom(initialState);
const mockGetProgress = jest.fn<
  Promise<ILocalWalletSyncProgress | undefined>,
  [{ networkId: string; accountId: string }]
>();
const mockSetAllowCellularSync = jest
  .fn<Promise<void>, [{ allow: boolean }]>()
  .mockResolvedValue(undefined);

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));
jest.mock('@onekeyhq/shared/src/locale', () => ({
  ETranslations: new Proxy({}, { get: (_target, key: string) => key }),
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));
jest.mock('@onekeyhq/shared/src/utils/swrCacheUtils', () => ({
  swrCacheUtils: { getWithTimestamp: jest.fn(), set: jest.fn() },
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocusedWhenEnabled: () => true,
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/privacyChain', () => ({
  privacyChainAtom: { atom: () => mockPrivacyChainAtom },
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePrivacyChain: {
      getLocalWalletSyncProgress: (params: {
        networkId: string;
        accountId: string;
      }) => mockGetProgress(params),
      setAllowCellularSync: (params: { allow: boolean }) =>
        mockSetAllowCellularSync(params),
    },
  },
}));
jest.mock('@onekeyhq/components', () => {
  const { useDeferredPromise } = jest.requireActual<
    typeof import('../../../../../components/src/hooks/useDeferredPromise')
  >('../../../../../components/src/hooks/useDeferredPromise');
  const Stack = ({
    children,
    testID,
  }: {
    children?: ReactNode;
    testID?: string;
  }) => <div data-testid={testID}>{children}</div>;
  return {
    getCurrentVisibilityState: () => true,
    onVisibilityStateChange: () => () => {},
    useDeferredPromise,
    useNetInfo: () => ({ isRawInternetReachable: true }),
    YStack: Stack,
    XStack: Stack,
    SizableText: Stack,
    Icon: () => null,
    Progress: ({ value }: { value: number }) => (
      <div role="progressbar" aria-valuenow={value} />
    ),
    Button: ({
      children,
      testID,
      onPress,
    }: {
      children?: ReactNode;
      testID?: string;
      onPress: () => void;
    }) => (
      <button type="button" data-testid={testID} onClick={onPress}>
        {children}
      </button>
    ),
    Toast: { error: jest.fn() },
  };
});

const networkId = 'zec--0';
const accountId = 'account-a';
const syncingProgress: ILocalWalletSyncProgress = {
  birthdayHeight: 100,
  backfillScannedHeight: 150,
  backfillTargetHeight: 200,
  backfillProgress: 0.5,
  isBackfillComplete: false,
  tipScannedHeight: 150,
  chainTip: 200,
  tipLag: 50,
  isTipCaughtUp: false,
  isSyncing: true,
};
const completedProgress: ILocalWalletSyncProgress = {
  ...syncingProgress,
  backfillScannedHeight: 200,
  backfillProgress: 1,
  isBackfillComplete: true,
  tipScannedHeight: 200,
  tipLag: 0,
  isTipCaughtUp: true,
  isSyncing: false,
};
let store: ReturnType<typeof createStore>;

function renderStatus() {
  return render(
    <ReceivePrivacySyncStatus networkId={networkId} accountId={accountId} />,
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <Provider store={store}>{children}</Provider>
      ),
    },
  );
}

async function advancePolling(ms = PRIVACY_CHAIN_SYNC_POLL_MS) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

describe('ReceivePrivacySyncStatus', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockGetProgress.mockReset();
    mockSetAllowCellularSync.mockClear();
    mockGetProgress.mockResolvedValue(completedProgress);
    store = createStore();
    store.set(mockPrivacyChainAtom, initialState);
  });

  afterEach(() => {
    cleanup();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('keeps preparation and normal syncing silent while continuing to observe progress', async () => {
    mockGetProgress
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(syncingProgress)
      .mockResolvedValueOnce(completedProgress);
    const screen = renderStatus();
    expect(screen.queryByTestId('receive-privacy-status')).toBeNull();

    await advancePolling(0);
    expect(screen.queryByTestId('receive-privacy-status')).toBeNull();
    await advancePolling();
    expect(screen.queryByTestId('receive-privacy-status')).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
    await advancePolling();
    expect(screen.queryByTestId('receive-privacy-status')).toBeNull();
    expect(mockGetProgress).toHaveBeenCalledTimes(3);
  });

  it('shows a polling failure after success and recovers on the next success', async () => {
    mockGetProgress
      .mockResolvedValueOnce(completedProgress)
      .mockRejectedValueOnce(new Error('Progress temporarily unavailable'))
      .mockResolvedValueOnce(syncingProgress);
    const screen = renderStatus();
    await advancePolling(0);
    expect(screen.queryByTestId('receive-privacy-status')).toBeNull();

    await advancePolling();
    expect(screen.getByText('privacy_sync_failed_retrying__msg')).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull();

    await advancePolling();
    expect(screen.queryByTestId('receive-privacy-status')).toBeNull();
    expect(screen.queryByText('privacy_sync_failed_retrying__msg')).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();

    await advancePolling();
    expect(screen.queryByTestId('receive-privacy-status')).toBeNull();
  });

  it.each([
    {
      overrides: {
        dataBlockedNetworkIds: [networkId],
        pausedNetworkIds: [networkId],
      },
      expected: 'privacy_sync_waiting_wifi__msg',
    },
    {
      overrides: { pausedNetworkIds: [networkId] },
      expected: 'syncing_paused__title',
    },
  ])(
    'keeps $expected ahead of a polling failure',
    async ({ overrides, expected }) => {
      store.set(mockPrivacyChainAtom, { ...initialState, ...overrides });
      mockGetProgress.mockRejectedValue(new Error('Progress unavailable'));
      const screen = renderStatus();
      await advancePolling(0);
      expect(screen.getByText(expected)).toBeTruthy();
      expect(
        screen.queryByText('privacy_sync_failed_retrying__msg'),
      ).toBeNull();
    },
  );

  it('retains the mobile data action when sync is waiting for Wi-Fi', async () => {
    store.set(mockPrivacyChainAtom, {
      ...initialState,
      dataBlockedNetworkIds: [networkId],
    });
    const screen = renderStatus();
    await advancePolling(0);
    expect(screen.getByText('privacy_sync_waiting_wifi__msg')).toBeTruthy();
    fireEvent.click(screen.getByTestId('receive-privacy-allow-mobile-data'));
    expect(mockSetAllowCellularSync).toHaveBeenCalledWith({ allow: true });
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('keeps a real scanner error visible after a successful progress read', async () => {
    store.set(mockPrivacyChainAtom, {
      ...initialState,
      syncErrorByNetworkId: { [networkId]: 'nodeUnreachable' },
    });
    const screen = renderStatus();
    await advancePolling(0);
    expect(screen.getByText('privacy_sync_failed_retrying__msg')).toBeTruthy();

    act(() => store.set(mockPrivacyChainAtom, initialState));
    expect(screen.queryByTestId('receive-privacy-status')).toBeNull();
  });

  it('does not display the previous account failure while the next account loads', async () => {
    let resolveNext!: (value: ILocalWalletSyncProgress) => void;
    mockGetProgress
      .mockRejectedValueOnce(new Error('Old account unavailable'))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveNext = resolve;
          }),
      );
    const screen = renderStatus();
    await advancePolling(0);
    expect(screen.getByText('privacy_sync_failed_retrying__msg')).toBeTruthy();

    screen.rerender(
      <ReceivePrivacySyncStatus networkId={networkId} accountId="account-b" />,
    );
    expect(screen.queryByTestId('receive-privacy-status')).toBeNull();
    expect(screen.queryByText('privacy_sync_failed_retrying__msg')).toBeNull();

    await act(async () => {
      resolveNext(completedProgress);
    });
    expect(screen.queryByTestId('receive-privacy-status')).toBeNull();
  });

  it.each([
    { nextNetworkId: networkId, nextAccountId: 'account-b' },
    { nextNetworkId: 'xmr--0', nextAccountId: accountId },
  ])(
    'ignores a late failure after switching to $nextNetworkId/$nextAccountId',
    async ({ nextNetworkId, nextAccountId }) => {
      let rejectPrevious!: (error: Error) => void;
      mockGetProgress.mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectPrevious = reject;
          }),
      );
      const screen = renderStatus();
      await advancePolling(0);
      expect(mockGetProgress).toHaveBeenLastCalledWith({
        networkId,
        accountId,
      });

      screen.rerender(
        <ReceivePrivacySyncStatus
          networkId={nextNetworkId}
          accountId={nextAccountId}
        />,
      );
      await advancePolling(0);
      expect(mockGetProgress).toHaveBeenLastCalledWith({
        networkId: nextNetworkId,
        accountId: nextAccountId,
      });
      expect(screen.queryByTestId('receive-privacy-status')).toBeNull();

      await act(async () => {
        rejectPrevious(new Error('Old request failed'));
      });
      expect(screen.queryByTestId('receive-privacy-status')).toBeNull();
      await advancePolling();
      expect(mockGetProgress).toHaveBeenCalledTimes(3);
      expect(screen.queryByTestId('receive-privacy-status')).toBeNull();
    },
  );
});
