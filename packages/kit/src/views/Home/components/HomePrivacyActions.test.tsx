/** @jest-environment jsdom */
import type { ReactNode } from 'react';

import { render, screen } from '@testing-library/react';

import type {
  IHomeMoneroEnableRequest,
  IHomePrivacyTokenStatus,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountOverview';
import xmrSettings from '@onekeyhq/kit-bg/src/vaults/impls/xmr/settings';

import { HomeTestIDs } from '../testIDs';

import { HomePrivacyActions } from './HomePrivacyActions';

import type { IHomePrivacyActionsPresentation } from './HomePrivacyActions';
import type {
  ILocalWalletPool,
  useLocalWalletPool,
} from '../../AssetDetails/pages/TokenDetails/useLocalWalletPool';

jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: { servicePrivacyChain: {} },
}));

const mockAccount = {
  ready: true,
  isNetworkNotMatched: false,
  account: { id: 'hd-1--0' },
  network: { id: 'xmr--0', isAllNetworks: false },
  vaultSettings: xmrSettings,
};
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({ activeAccount: mockAccount }),
}));

let mockHomePrivacyTokenStatus: IHomePrivacyTokenStatus | undefined;
let mockEnableRequest: IHomeMoneroEnableRequest | undefined;
const mockSetEnableRequest = jest.fn(
  (
    update: (
      previous: IHomeMoneroEnableRequest | undefined,
    ) => IHomeMoneroEnableRequest | undefined,
  ) => {
    mockEnableRequest = update(mockEnableRequest);
  },
);
const mockSetHomePrivacyTokenStatus = jest.fn(
  (
    update: (
      previous: IHomePrivacyTokenStatus | undefined,
    ) => IHomePrivacyTokenStatus | undefined,
  ) => {
    mockHomePrivacyTokenStatus = update(mockHomePrivacyTokenStatus);
  },
);
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountOverview', () => ({
  useHomeMoneroEnableRequestAtom: () => [
    mockEnableRequest,
    mockSetEnableRequest,
  ],
  useHomePrivacyTokenStatusAtom: () => [
    mockHomePrivacyTokenStatus,
    mockSetHomePrivacyTokenStatus,
  ],
}));

const mockOpenEnableSetup = jest.fn(async () => undefined);

const mockPool = jest.fn<
  ILocalWalletPool,
  [Parameters<typeof useLocalWalletPool>[0]]
>();
jest.mock('../../AssetDetails/pages/TokenDetails/useLocalWalletPool', () => ({
  ...jest.requireActual<
    typeof import('../../AssetDetails/pages/TokenDetails/useLocalWalletPool')
  >('../../AssetDetails/pages/TokenDetails/useLocalWalletPool'),
  useLocalWalletPool: (params: Parameters<typeof useLocalWalletPool>[0]) =>
    mockPool(params),
}));
jest.mock(
  '../../AssetDetails/pages/TokenDetails/LocalWalletPoolStatus',
  () => ({
    LocalWalletPoolStatus: ({
      accountId,
      renderEnableTrigger,
    }: {
      accountId: string;
      renderEnableTrigger: (props: {
        onPress: () => Promise<void>;
        loading: boolean;
        disabled: boolean;
      }) => ReactNode;
    }) => (
      <div data-testid="privacy-enable" data-owner={accountId}>
        {renderEnableTrigger({
          onPress: () => mockOpenEnableSetup(),
          loading: false,
          disabled: false,
        })}
      </div>
    ),
  }),
);
jest.mock('./WalletActions/WalletActionMore', () => ({
  WalletActionMore: () => null,
}));
jest.mock('./WalletActions/RawActions', () => ({
  RawActions: Object.assign(
    ({ children }: { children: ReactNode }) => <div>{children}</div>,
    {
      Placeholder: ({ testID }: { testID: string }) => (
        <div data-testid={testID} />
      ),
    },
  ),
}));
jest.mock('@onekeyhq/components', () => ({
  Button: ({ children, testID }: { children: ReactNode; testID: string }) => (
    <button type="button" data-testid={testID}>
      {children}
    </button>
  ),
}));

function pool(overrides: Partial<ILocalWalletPool> = {}): ILocalWalletPool {
  return {
    settings: xmrSettings.localWallet,
    hasPooledBalance: true,
    isWalletSupported: true,
    isUnsupportedWallet: false,
    pool: xmrSettings.localWallet?.pools[0],
    state: { enabled: false, paused: false },
    isStateSettled: true,
    isReady: true,
    enabled: false,
    balance: undefined,
    lastSyncedAt: undefined,
    poolBalance: undefined,
    poolAddress: undefined,
    addresses: undefined,
    syncProgress: undefined,
    syncStatusText: null,
    syncStatus: 'off',
    isPreparing: false,
    isSyncPaused: false,
    isNetworkPaused: false,
    hasSyncError: false,
    hasAttemptedBalance: false,
    actionBusy: false,
    busy: false,
    accountName: 'Account #1',
    isTempWallet: false,
    refresh: jest.fn(),
    refreshBalanceNow: jest.fn(async () => undefined),
    startSync: jest.fn(async () => undefined),
    pauseSync: jest.fn(async () => undefined),
    enableAccount: jest.fn(async () => undefined),
    ...overrides,
  };
}

const view = (
  onPresentationChange?: (
    presentation: IHomePrivacyActionsPresentation,
  ) => void,
) => (
  <HomePrivacyActions onPresentationChange={onPresentationChange}>
    <div data-testid="standard-wallet-actions" />
  </HomePrivacyActions>
);

beforeEach(() => {
  mockAccount.ready = true;
  mockAccount.account = { id: 'hd-1--0' };
  mockAccount.network = { id: 'xmr--0', isAllNetworks: false };
  mockPool.mockReset();
  mockPool.mockReturnValue(pool());
  mockHomePrivacyTokenStatus = undefined;
  mockSetHomePrivacyTokenStatus.mockClear();
  mockEnableRequest = undefined;
  mockSetEnableRequest.mockClear();
  mockOpenEnableSetup.mockClear();
});

it('continues a successful address creation into the existing enable setup once ready', () => {
  mockEnableRequest = {
    walletId: 'hd-1',
    indexedAccountId: 'hd-1--0',
    accountId: 'hd-1--0',
    networkId: 'xmr--0',
  };
  mockPool.mockReturnValue(pool({ isReady: false, state: undefined }));
  const page = render(view());
  expect(mockOpenEnableSetup).not.toHaveBeenCalled();

  const readyPool = pool();
  mockPool.mockReturnValue(readyPool);
  page.rerender(view());
  expect(mockOpenEnableSetup).toHaveBeenCalledTimes(1);
  expect(mockEnableRequest).toBeUndefined();
  expect(readyPool.enableAccount).not.toHaveBeenCalled();
  page.rerender(view());
  expect(mockOpenEnableSetup).toHaveBeenCalledTimes(1);
});

it('does not open setup for a creation request belonging to another account', () => {
  mockEnableRequest = {
    walletId: 'hd-1',
    indexedAccountId: 'hd-1--1',
    accountId: 'hd-1--1',
    networkId: 'xmr--0',
  };
  render(view());
  expect(mockOpenEnableSetup).not.toHaveBeenCalled();
});

it('replaces only the action row until enablement is confirmed', () => {
  const page = render(view());
  expect(screen.getByTestId(HomeTestIDs.enableMoneroButton)).toBeTruthy();
  expect(screen.queryByTestId('standard-wallet-actions')).toBeNull();
  mockPool.mockReturnValue(pool({ busy: true }));
  page.rerender(view());
  expect(screen.queryByTestId('standard-wallet-actions')).toBeNull();
  mockPool.mockReturnValue(pool({ enabled: true, syncStatus: 'syncing' }));
  page.rerender(view());
  expect(screen.getByTestId('standard-wallet-actions')).toBeTruthy();
  expect(screen.queryByTestId(HomeTestIDs.enableMoneroButton)).toBeNull();
});

it.each(['preparing', 'waitingWifi', 'error', 'synced'] as const)(
  'keeps the standard actions for an enabled account while %s',
  (syncStatus) => {
    mockPool.mockReturnValue(pool({ enabled: true, syncStatus }));
    render(view());
    expect(screen.getByTestId('standard-wallet-actions')).toBeTruthy();
    expect(screen.queryByTestId(HomeTestIDs.enableMoneroButton)).toBeNull();
  },
);

it.each(['accountPaused', 'chainPaused'] as const)(
  'replaces standard actions with Enable while %s and restores them on resume',
  (syncStatus) => {
    const onPresentationChange = jest.fn();
    mockPool.mockReturnValue(pool({ enabled: true, syncStatus: 'syncing' }));
    const page = render(view(onPresentationChange));
    expect(screen.getByTestId('standard-wallet-actions')).toBeTruthy();

    mockPool.mockReturnValue(
      pool({ enabled: true, syncStatus, isSyncPaused: true }),
    );
    page.rerender(view(onPresentationChange));
    expect(screen.getByTestId(HomeTestIDs.enableMoneroButton)).toBeTruthy();
    expect(screen.queryByTestId('standard-wallet-actions')).toBeNull();
    expect(onPresentationChange).toHaveBeenLastCalledWith({
      ownerKey: 'xmr--0:hd-1--0',
      variant: 'privacy-enable',
    });

    mockPool.mockReturnValue(pool({ enabled: true, syncStatus: 'preparing' }));
    page.rerender(view(onPresentationChange));
    expect(screen.getByTestId('standard-wallet-actions')).toBeTruthy();
    expect(screen.queryByTestId(HomeTestIDs.enableMoneroButton)).toBeNull();
    expect(onPresentationChange).toHaveBeenLastCalledWith({
      ownerKey: 'xmr--0:hd-1--0',
      variant: 'standard',
    });
  },
);

it('withholds actions while the newly selected account state is unknown', () => {
  const page = render(view());
  mockAccount.account = { id: 'hd-1--1' };
  mockPool.mockReturnValue(pool({ isReady: false, state: undefined }));
  page.rerender(view());
  expect(screen.getByTestId(HomeTestIDs.walletActionsLoading)).toBeTruthy();
  expect(screen.queryByTestId(HomeTestIDs.enableMoneroButton)).toBeNull();
  expect(screen.queryByTestId('standard-wallet-actions')).toBeNull();
});

it('reports distinct header layouts without reusing the previous account state', () => {
  const onPresentationChange = jest.fn();
  const page = render(view(onPresentationChange));
  expect(onPresentationChange).toHaveBeenLastCalledWith({
    ownerKey: 'xmr--0:hd-1--0',
    variant: 'privacy-enable',
  });
  mockPool.mockReturnValue(pool({ enabled: true, syncStatus: 'syncing' }));
  page.rerender(view(onPresentationChange));
  expect(onPresentationChange).toHaveBeenLastCalledWith({
    ownerKey: 'xmr--0:hd-1--0',
    variant: 'standard',
  });
  mockAccount.account = { id: 'hd-1--1' };
  mockPool.mockReturnValue(pool({ isReady: false, state: undefined }));
  page.rerender(view(onPresentationChange));
  expect(onPresentationChange).toHaveBeenLastCalledWith({
    ownerKey: 'xmr--0:hd-1--1',
    variant: 'privacy-loading',
  });
});

it('clears unavailable token status and preserves a newer owner on unmount', () => {
  mockPool.mockReturnValue(pool({ enabled: true, syncStatus: 'syncing' }));
  const page = render(view());
  expect(mockHomePrivacyTokenStatus).toEqual({
    accountId: 'hd-1--0',
    networkId: 'xmr--0',
    status: 'syncing',
  });
  const publishCount = mockSetHomePrivacyTokenStatus.mock.calls.length;
  page.rerender(view());
  expect(mockSetHomePrivacyTokenStatus).toHaveBeenCalledTimes(publishCount);

  mockAccount.account = { id: 'hd-1--1' };
  mockPool.mockReturnValue(pool({ isReady: false, state: undefined }));
  page.rerender(view());
  expect(mockHomePrivacyTokenStatus).toBeUndefined();

  mockPool.mockReturnValue(
    pool({ enabled: true, syncStatus: 'accountPaused' }),
  );
  page.rerender(view());
  expect(mockHomePrivacyTokenStatus).toEqual({
    accountId: 'hd-1--1',
    networkId: 'xmr--0',
    status: 'accountPaused',
  });
  mockPool.mockReturnValue(
    pool({
      enabled: true,
      syncStatus: 'unavailable',
      state: { enabled: true, paused: false, privacyDisabled: true },
    }),
  );
  page.rerender(view());
  expect(mockHomePrivacyTokenStatus).toBeUndefined();

  const newerOwner: IHomePrivacyTokenStatus = {
    accountId: 'hd-1--2',
    networkId: 'xmr--0',
    status: 'syncing',
  };
  mockHomePrivacyTokenStatus = newerOwner;
  page.unmount();
  expect(mockHomePrivacyTokenStatus).toBe(newerOwner);
});

it.each(['evm--1', 'zec--0', 'all--0'])(
  'does not mount the local scanning lifecycle on %s',
  (networkId) => {
    mockAccount.network = {
      id: networkId,
      isAllNetworks: networkId === 'all--0',
    };
    render(view());
    expect(screen.getByTestId('standard-wallet-actions')).toBeTruthy();
    expect(mockPool).not.toHaveBeenCalled();
  },
);

it.each([
  { isUnsupportedWallet: true },
  { isTempWallet: true },
  { state: { enabled: false, paused: false, privacyDisabled: true } },
])('does not offer an unsupported enable action (%j)', (overrides) => {
  mockPool.mockReturnValue(pool(overrides));
  render(view());
  expect(screen.queryByTestId(HomeTestIDs.enableMoneroButton)).toBeNull();
});
