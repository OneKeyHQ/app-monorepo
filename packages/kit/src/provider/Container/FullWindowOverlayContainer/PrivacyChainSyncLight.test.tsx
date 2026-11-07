/** @jest-environment jsdom */
import type { ReactNode } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import type { IPrivacyChainScanState } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { PrivacyChainSyncLight } from './PrivacyChainSyncLight';

import type { IOverlayViewProps } from '@onekeyfe/react-native-native-overlay';

let mockState: IPrivacyChainScanState;
let mockStage: { step: string } | undefined;
let mockIsCellular = false;
let mockOverlayProps: IOverlayViewProps | undefined;
const mockPause = jest.fn(async (_params: { networkId: string }) => undefined);
const mockSetNetwork = jest.fn(
  async (_params: { isCellular: boolean | undefined }) => undefined,
);
const mockResume = jest.fn(
  async (_params: { networkId: string; trigger: string }) => undefined,
);
let mockVaultSettings: { localWallet?: { syncedBelowBlocks?: number } } = {};
jest.mock('@onekeyfe/react-native-native-overlay', () => ({
  OverlayView: (props: IOverlayViewProps) => {
    mockOverlayProps = props;
    return props.visible ? props.children : null;
  },
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
  useIsCellularNetwork: () => mockIsCellular,
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: { BackgroundThreadReady: 'ready' },
  appEventBus: { on: jest.fn(), off: jest.fn() },
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePrivacyChainAtom: () => [mockState],
  useDeviceStageAtom: () => [mockStage],
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePrivacyChain: {
      setDeviceNetworkState: (params: { isCellular: boolean | undefined }) =>
        mockSetNetwork(params),
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
      getVaultSettings: async () => mockVaultSettings,
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
    Icon: Wrapper,
    SizableText: Wrapper,
    Stack: Wrapper,
    XStack: Wrapper,
    YStack: Wrapper,
    useMedia: () => ({ md: false }),
    useSafeAreaInsets: () => ({ bottom: 0 }),
  };
});

const nativeEnv = platformEnv as { isNative: boolean; isNativeIOS: boolean };

beforeEach(() => {
  nativeEnv.isNative = false;
  nativeEnv.isNativeIOS = false;
  mockIsCellular = false;
  mockStage = undefined;
  mockOverlayProps = undefined;
  mockPause.mockClear();
  mockResume.mockClear();
  mockState = {
    boostingNetworkIds: [],
    dataBlockedNetworkIds: [],
    pausedNetworkIds: [],
    preparingAccountKeys: [],
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
  expect(text).toContain('privacy_sync_syncing__title · 19.1%');
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

it('expands both networks, and pauses all of them', async () => {
  mockState.boostingNetworkIds = ['zec--0', 'xmr--0'];
  mockState.progress['zec--0:account'] = scanProgress(107);
  mockState.progress['xmr--0:account'] = scanProgress(400);
  render(<PrivacyChainSyncLight />);
  expect(
    await screen.findByTestId('privacy-chain-sync-network-zec--0'),
  ).toBeTruthy();
  expect(screen.queryByTestId('privacy-chain-sync-network-xmr--0')).toBeNull();
  await act(async () => {
    fireEvent.click(screen.getByTestId('privacy-chain-sync-light-details-btn'));
  });
  expect(
    screen.getByTestId('privacy-chain-sync-network-xmr--0').textContent,
  ).toContain('Monero');
  expect(
    screen.getByTestId('privacy-chain-sync-network-xmr--0').textContent,
  ).toContain('40.0%');
  // The summary already shows the percentage; the detail line adds the rest.
  expect(
    screen.getByTestId('privacy-chain-sync-light-detail-xmr--0').textContent,
  ).not.toContain('40.0%');
  await act(async () => {
    fireEvent.click(screen.getByTestId('privacy-chain-sync-light-pause-btn'));
  });
  expect(mockPause.mock.calls).toEqual([
    [{ networkId: 'zec--0' }],
    [{ networkId: 'xmr--0' }],
  ]);
});

// Waiting for Wi-Fi must not keep the light up for the whole cellular session.
it('pauses a chain that waits for Wi-Fi, folding it into the Continue bar', async () => {
  mockState.dataBlockedNetworkIds = ['zec--0'];
  mockState.progress['zec--0:account'] = scanProgress(107);
  render(<PrivacyChainSyncLight />);
  await screen.findByTestId('privacy-chain-sync-network-zec--0');
  await act(async () => {
    fireEvent.click(screen.getByTestId('privacy-chain-sync-light-pause-btn'));
  });
  expect(mockPause.mock.calls).toEqual([[{ networkId: 'zec--0' }]]);
});

// The light keeps a paused chain, so Continue is where Pause was.
it('keeps a paused chain with a Continue that resumes every paused chain', async () => {
  mockState.pausedNetworkIds = ['zec--0', 'xmr--0'];
  mockState.progress['zec--0:account'] = scanProgress(107);
  render(<PrivacyChainSyncLight />);
  expect(
    (await screen.findByTestId('privacy-chain-sync-light')).textContent,
  ).toContain('syncing_paused__title');
  expect(screen.queryByTestId('privacy-chain-sync-light-pause-btn')).toBeNull();
  await act(async () => {
    fireEvent.click(screen.getByTestId('privacy-chain-sync-light-resume-btn'));
  });
  expect(mockResume.mock.calls).toEqual([
    [{ networkId: 'zec--0', trigger: 'manual-sync' }],
    [{ networkId: 'xmr--0', trigger: 'manual-sync' }],
  ]);
});

// Scanning never finishes; a chain that has caught up shows no "synced" light.
it('shows nothing for a chain that has caught up', async () => {
  mockState.boostingNetworkIds = ['zec--0'];
  mockState.progress['zec--0:account'] = {
    ...scanProgress(1000),
    backfillProgress: 1,
    isBackfillComplete: true,
    tipLag: 0,
    isTipCaughtUp: true,
    isSyncing: false,
  };
  render(<PrivacyChainSyncLight />);
  expect(screen.queryByTestId('privacy-chain-sync-light')).toBeNull();
});

// Zcash trails its tip by a few blocks when synced; read against a default of 1 it would flash on.
it('does not flash for a chain within its synced threshold before the threshold is read', async () => {
  mockVaultSettings = { localWallet: { syncedBelowBlocks: 48 } };
  try {
    mockState.boostingNetworkIds = ['zec--flash'];
    mockState.progress['zec--flash:account'] = {
      ...scanProgress(990),
      backfillProgress: 1,
      isBackfillComplete: true,
      tipLag: 10,
    };
    render(<PrivacyChainSyncLight />);
    expect(screen.queryByTestId('privacy-chain-sync-light')).toBeNull();
    await act(async () => undefined);
    expect(screen.queryByTestId('privacy-chain-sync-light')).toBeNull();
  } finally {
    mockVaultSettings = {};
  }
});

it('prepares after an explicit start, without that account figures', async () => {
  mockState.boostingNetworkIds = ['xmr--0'];
  mockState.preparingAccountKeys = ['xmr--0:active'];
  mockState.progress['xmr--0:active'] = scanProgress(191);
  render(<PrivacyChainSyncLight />);
  await screen.findByText(/Monero/);
  const text = screen.getByTestId(
    'privacy-chain-sync-network-xmr--0',
  ).textContent;
  expect(text).toContain('global.preparing');
  expect(text).not.toContain('%');
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
  ).toBe('107 / 1,000');
  fireEvent.click(screen.getByTestId('privacy-chain-sync-light-pause-btn'));
  expect(mockPause).toHaveBeenCalledWith({ networkId: 'zec--0' });
});

it('shows a reliable time left collapsed and the percentage only when expanded', async () => {
  mockState.boostingNetworkIds = ['zec--0'];
  mockState.progress['zec--0:account'] = {
    ...scanProgress(107),
    blocksPerSec: 10,
    blocksPerSecSince: Date.now() - 120_000,
  };
  render(<PrivacyChainSyncLight />);
  const light = screen.getByTestId('privacy-chain-sync-light');
  expect(light.textContent).toMatch(/privacy_sync_syncing__title · ~/);
  expect(light.textContent).not.toContain('10.7%');
  await act(async () => {
    fireEvent.click(screen.getByTestId('privacy-chain-sync-light-details-btn'));
  });
  expect(
    screen.getByTestId('privacy-chain-sync-light-detail').textContent,
  ).toBe('107 / 1,000 · 10.7%');
});

describe('on a phone', () => {
  beforeEach(() => {
    nativeEnv.isNative = true;
  });

  it('marks a scan on mobile data with an icon, not words', async () => {
    mockIsCellular = true;
    mockState.boostingNetworkIds = ['zec--0'];
    mockState.progress['zec--0:account'] = scanProgress(107);
    render(<PrivacyChainSyncLight />);
    expect(
      screen.getByTestId('privacy-chain-sync-mobile-data-zec--0'),
    ).toBeTruthy();
    await act(async () => {
      fireEvent.click(
        screen.getByTestId('privacy-chain-sync-light-details-btn'),
      );
    });
    expect(
      screen.getByTestId('privacy-chain-sync-light-detail').textContent,
    ).toBe('107 / 1,000');
  });

  it('asks to keep the app open only once expanded', async () => {
    mockState.boostingNetworkIds = ['zec--0'];
    mockState.progress['zec--0:account'] = scanProgress(107);
    render(<PrivacyChainSyncLight />);
    expect(
      screen.queryByTestId('privacy-chain-sync-light-keep-open'),
    ).toBeNull();
    await act(async () => {
      fireEvent.click(
        screen.getByTestId('privacy-chain-sync-light-details-btn'),
      );
    });
    expect(
      screen.getByTestId('privacy-chain-sync-light-keep-open').textContent,
    ).toBe('privacy_sync_keep_open__msg');
  });

  // Waiting for Wi-Fi nothing is scanning: no mobile data icon, nothing to keep open, but Pause
  // still folds it away.
  it('waits for Wi-Fi collapsed and offers the allow button once expanded', async () => {
    mockIsCellular = true;
    mockState.dataBlockedNetworkIds = ['zec--0'];
    mockState.progress['zec--0:account'] = scanProgress(107);
    render(<PrivacyChainSyncLight />);
    expect(
      screen.getByTestId('privacy-chain-sync-network-zec--0').textContent,
    ).toBe('privacy_sync_waiting_wifi__msg');
    expect(
      screen.queryByTestId('privacy-chain-sync-light-allow-data-btn'),
    ).toBeNull();
    expect(
      screen.queryByTestId('privacy-chain-sync-light-pause-btn'),
    ).toBeTruthy();
    expect(
      screen.queryByTestId('privacy-chain-sync-mobile-data-zec--0'),
    ).toBeNull();
    await act(async () => {
      fireEvent.click(
        screen.getByTestId('privacy-chain-sync-light-details-btn'),
      );
    });
    expect(
      screen.getByTestId('privacy-chain-sync-light-allow-data-btn').textContent,
    ).toBe('privacy_sync_mobile_data__title');
    expect(
      screen.getByTestId('privacy-chain-sync-network-zec--0').textContent,
    ).not.toContain('privacy_sync_mobile_data__desc');
    expect(
      screen.queryByTestId('privacy-chain-sync-light-keep-open'),
    ).toBeNull();
  });
});

it('pauses a chain with a storage error along with the other one', async () => {
  mockState.storageUnsupportedNetworkIds = ['zec--0'];
  mockState.boostingNetworkIds = ['zec--0', 'xmr--0'];
  mockState.progress['xmr--0:account'] = scanProgress(400);
  render(<PrivacyChainSyncLight />);
  expect(
    screen.getByTestId('privacy-chain-sync-light-detail').textContent,
  ).toContain('privacy_error_webview_outdated__msg');
  await act(async () => {
    fireEvent.click(screen.getByTestId('privacy-chain-sync-light-pause-btn'));
  });
  // An outdated WebView must not keep the light up either.
  expect(mockPause.mock.calls).toEqual([
    [{ networkId: 'zec--0' }],
    [{ networkId: 'xmr--0' }],
  ]);
});

describe('under a hardware stage', () => {
  beforeEach(() => {
    mockState.boostingNetworkIds = ['zec--0'];
    mockState.progress['zec--0:account'] = scanProgress(107);
  });

  // Same native level as the stage and requested after it: it would cover
  // the stage and stay tappable during device confirmation.
  it('steps aside on iOS while a device stage is up', () => {
    nativeEnv.isNativeIOS = true;
    mockStage = { step: 'loading' };
    const { rerender } = render(<PrivacyChainSyncLight />);
    expect(mockOverlayProps?.level).toBe('hardware');
    expect(mockOverlayProps?.visible).toBe(false);
    expect(screen.queryByTestId('privacy-chain-sync-light')).toBeNull();

    mockStage = { step: 'off' };
    rerender(<PrivacyChainSyncLight />);
    expect(mockOverlayProps?.visible).toBe(true);
    expect(screen.getByTestId('privacy-chain-sync-light')).toBeTruthy();
  });

  // The light unmounts during the stage; a remount would first report the network as unknown.
  it('keeps one network report across a device stage', () => {
    nativeEnv.isNativeIOS = true;
    mockSetNetwork.mockClear();
    const { rerender } = render(<PrivacyChainSyncLight />);
    mockStage = { step: 'loading' };
    rerender(<PrivacyChainSyncLight />);
    mockStage = { step: 'off' };
    rerender(<PrivacyChainSyncLight />);
    expect(mockSetNetwork.mock.calls).toEqual([[{ isCellular: false }]]);
  });

  it('shows on iOS when no stage was ever opened', () => {
    nativeEnv.isNativeIOS = true;
    render(<PrivacyChainSyncLight />);
    expect(mockOverlayProps?.visible).toBe(true);
    expect(screen.getByTestId('privacy-chain-sync-light')).toBeTruthy();
  });

  // The stage's overlay level already covers the app tree the light renders in.
  it('stays in the app tree elsewhere', () => {
    mockStage = { step: 'loading' };
    render(<PrivacyChainSyncLight />);
    expect(mockOverlayProps).toBeUndefined();
    expect(screen.getByTestId('privacy-chain-sync-light')).toBeTruthy();
  });
});
