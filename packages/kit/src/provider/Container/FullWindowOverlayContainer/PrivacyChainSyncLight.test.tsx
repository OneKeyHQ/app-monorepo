/** @jest-environment jsdom */
import type { ReactNode } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import type { IPrivacyChainScanState } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { PrivacyChainSyncLight } from './PrivacyChainSyncLight';

let mockState: IPrivacyChainScanState;
const mockPause = jest.fn(async (_params: { networkId: string }) => undefined);
const mockResume = jest.fn(
  async (_params: { networkId: string; trigger: string }) => undefined,
);
jest.mock('@onekeyfe/react-native-native-overlay', () => ({
  OverlayView: () => null,
}));
jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: async () => undefined,
  deactivateKeepAwake: async () => undefined,
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false, isNativeIOS: false },
}));
jest.mock('@onekeyhq/kit/src/hooks/useIsCellularNetwork', () => ({
  useIsCellularNetwork: () => false,
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: { BackgroundThreadReady: 'ready' },
  appEventBus: { on: jest.fn(), off: jest.fn() },
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePrivacyChainAtom: () => [mockState],
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePrivacyChain: {
      setDeviceNetworkState: async () => undefined,
      pauseLocalWalletScan: (params: { networkId: string }) =>
        mockPause(params),
      startForegroundBoost: (params: { networkId: string; trigger: string }) =>
        mockResume(params),
      setAllowCellularSync: async () => undefined,
    },
    serviceNetwork: {
      getNetworkSafe: async ({ networkId }: { networkId: string }) => ({
        name: networkId === 'xmr--0' ? 'Monero' : 'Zcash',
      }),
      getVaultSettings: async () => ({}),
    },
  },
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => {
  const { useCallback, useEffect, useState } =
    jest.requireActual<typeof import('react')>('react');
  return {
    usePromiseResult: (fn: () => Promise<unknown>, deps: unknown[]) => {
      const [result, setResult] = useState<unknown>();
      const run = useCallback(async () => {
        setResult(await fn());
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, deps);
      useEffect(() => {
        void run();
      }, [run]);
      return { result, run };
    },
  };
});
jest.mock('@onekeyhq/components', () => {
  const Wrapper = ({
    children,
    testID,
  }: {
    children?: ReactNode;
    testID?: string;
  }) => <div data-testid={testID}>{children}</div>;
  const Button = ({
    children,
    testID,
    title,
    onPress,
  }: {
    children?: ReactNode;
    testID?: string;
    title?: string;
    onPress?: () => void;
  }) => (
    <button
      type="button"
      data-testid={testID}
      aria-label={title}
      onClick={onPress}
    >
      {children}
    </button>
  );
  return {
    Button,
    IconButton: Button,
    Icon: () => null,
    SizableText: Wrapper,
    Stack: Wrapper,
    XStack: Wrapper,
    YStack: Wrapper,
    useMedia: () => ({ md: false }),
    useSafeAreaInsets: () => ({ bottom: 0 }),
  };
});

beforeEach(() => {
  mockPause.mockClear();
  mockResume.mockClear();
  mockState = {
    boostingNetworkIds: [],
    dataBlockedNetworkIds: [],
    pausedNetworkIds: [],
    progress: {},
    syncErrorByNetworkId: {},
    storageUnsupportedNetworkIds: [],
  };
});

function scanProgress(
  scanned: number,
): IPrivacyChainScanState['progress'][string] {
  return {
    birthdayHeight: 0,
    backfillScannedHeight: scanned,
    backfillTargetHeight: 1000,
    backfillProgress: scanned / 1000,
    isBackfillComplete: false,
    tipScannedHeight: scanned,
    chainTip: 1000,
    tipLag: 1000 - scanned,
    isTipCaughtUp: false,
    isSyncing: true,
  };
}

it('keeps scanning instead of preparing when another account is waiting for a cursor', async () => {
  mockState.boostingNetworkIds = ['xmr--0'];
  mockState.progress = {
    'xmr--0:active': scanProgress(191),
    'xmr--0:queued': { ...scanProgress(0), backfillScannedHeight: null },
  };
  render(<PrivacyChainSyncLight />);
  await screen.findByText(/Monero/);
  const text = screen.getByTestId(
    'privacy-chain-sync-network-xmr--0',
  ).textContent;
  expect(text).toContain('global.syncing 19.1%');
  expect(text).not.toContain('global.preparing');
});

it('prepares without a percentage until this chain has an actual cursor', async () => {
  mockState.boostingNetworkIds = ['xmr--0'];
  mockState.progress['xmr--0:queued'] = {
    ...scanProgress(0),
    backfillScannedHeight: null,
  };
  render(<PrivacyChainSyncLight />);
  await screen.findByText(/Monero/);
  const text = screen.getByTestId(
    'privacy-chain-sync-network-xmr--0',
  ).textContent;
  expect(text).toContain('global.preparing');
  expect(text).not.toContain('%');
});

it('expands both networks, pauses both and collapses back to one row', async () => {
  mockState.boostingNetworkIds = ['zec--0', 'xmr--0'];
  mockState.progress['zec--0:account'] = scanProgress(107);
  mockState.progress['xmr--0:account'] = scanProgress(400);
  render(<PrivacyChainSyncLight />);
  expect(screen.getByTestId('privacy-chain-sync-network-zec--0')).toBeTruthy();
  expect(screen.queryByTestId('privacy-chain-sync-network-xmr--0')).toBeNull();
  await act(async () => {
    fireEvent.click(screen.getByTestId('privacy-chain-sync-light-details-btn'));
  });
  expect(
    screen.getByTestId('privacy-chain-sync-network-zec--0').textContent,
  ).toContain('Zcash');
  expect(
    screen.getByTestId('privacy-chain-sync-network-xmr--0').textContent,
  ).toContain('Monero');
  expect(
    screen.getByTestId('privacy-chain-sync-light-detail-xmr--0').textContent,
  ).toContain('40.0%');
  fireEvent.click(screen.getByTestId('privacy-chain-sync-light-pause-btn'));
  expect(mockPause.mock.calls).toEqual([
    [{ networkId: 'zec--0' }],
    [{ networkId: 'xmr--0' }],
  ]);
  await act(async () => {
    fireEvent.click(screen.getByTestId('privacy-chain-sync-light-details-btn'));
  });
  expect(screen.queryByTestId('privacy-chain-sync-network-xmr--0')).toBeNull();
});

it('keeps a paused network visible when expanded alongside a running network', async () => {
  mockState.boostingNetworkIds = ['zec--0'];
  mockState.pausedNetworkIds = ['xmr--0'];
  mockState.progress['zec--0:account'] = scanProgress(107);
  render(<PrivacyChainSyncLight />);
  await act(async () => {
    fireEvent.click(screen.getByTestId('privacy-chain-sync-light-details-btn'));
  });
  expect(
    screen.getByTestId('privacy-chain-sync-network-xmr--0').textContent,
  ).toContain('syncing_paused__title');
  fireEvent.click(screen.getByTestId('privacy-chain-sync-light-resume-btn'));
  expect(mockResume).toHaveBeenCalledWith({
    networkId: 'xmr--0',
    trigger: 'manual-sync',
  });
  expect(mockPause).not.toHaveBeenCalled();
});

it('keeps detailed progress collapsed and expands it on demand', async () => {
  mockState.boostingNetworkIds = ['zec--0'];
  mockState.progress['zec--0:account'] = {
    birthdayHeight: 0,
    backfillScannedHeight: 107,
    backfillTargetHeight: 1000,
    backfillProgress: 0.107,
    isBackfillComplete: false,
    tipScannedHeight: 100,
    chainTip: 1000,
    tipLag: 900,
    isTipCaughtUp: false,
    isSyncing: true,
  };
  render(<PrivacyChainSyncLight />);
  expect(screen.getByTestId('privacy-chain-sync-light')).toBeTruthy();
  expect(screen.getByTestId('privacy-chain-sync-light').textContent).toContain(
    '10.7%',
  );
  expect(screen.queryByTestId('privacy-chain-sync-light-detail')).toBeNull();
  await act(async () => {
    fireEvent.click(screen.getByTestId('privacy-chain-sync-light-details-btn'));
  });
  expect(
    screen.getByTestId('privacy-chain-sync-light-detail').textContent,
  ).toContain('10.7%');
  fireEvent.click(screen.getByTestId('privacy-chain-sync-light-pause-btn'));
  expect(mockPause).toHaveBeenCalledWith({ networkId: 'zec--0' });
});

it.each(['preparing', 'complete'])(
  'resumes the paused scan from the same compact control when progress is %s',
  async (status) => {
    mockState.pausedNetworkIds = ['zec--0'];
    if (status === 'complete') {
      mockState.progress['zec--0:account'] = {
        birthdayHeight: 100,
        backfillScannedHeight: 1000,
        backfillTargetHeight: 1000,
        backfillProgress: 1,
        isBackfillComplete: true,
        tipScannedHeight: 1000,
        chainTip: 1000,
        tipLag: 0,
        isTipCaughtUp: true,
        isSyncing: false,
      };
    }
    render(<PrivacyChainSyncLight />);
    await act(async () => {
      fireEvent.click(
        screen.getByTestId('privacy-chain-sync-light-resume-btn'),
      );
    });
    expect(mockResume).toHaveBeenCalledWith({
      networkId: 'zec--0',
      trigger: 'manual-sync',
    });
    expect(
      screen.queryByTestId('privacy-chain-sync-light-pause-btn'),
    ).toBeNull();
  },
);

it.each(['running', 'paused'])(
  'keeps the other chain %s control available while a storage error is visible',
  async (status) => {
    mockState.storageUnsupportedNetworkIds = ['zec--0'];
    mockState.boostingNetworkIds =
      status === 'running' ? ['zec--0', 'xmr--0'] : ['zec--0'];
    mockState.pausedNetworkIds = status === 'paused' ? ['xmr--0'] : [];
    render(<PrivacyChainSyncLight />);
    expect(
      screen.getByTestId('privacy-chain-sync-light-detail').textContent,
    ).toContain('privacy_error_webview_outdated__msg');
    const actionId =
      status === 'running'
        ? 'privacy-chain-sync-light-pause-btn'
        : 'privacy-chain-sync-light-resume-btn';
    await act(async () => {
      fireEvent.click(screen.getByTestId(actionId));
    });
    if (status === 'running') {
      expect(mockPause.mock.calls).toEqual([[{ networkId: 'xmr--0' }]]);
    } else {
      expect(mockResume.mock.calls).toEqual([
        [{ networkId: 'xmr--0', trigger: 'manual-sync' }],
      ]);
    }
    await act(async () => {
      fireEvent.click(
        screen.getByTestId('privacy-chain-sync-light-details-btn'),
      );
    });
    expect(
      screen.getByTestId('privacy-chain-sync-light-detail').textContent,
    ).toContain('privacy_error_webview_outdated__msg');
  },
);
