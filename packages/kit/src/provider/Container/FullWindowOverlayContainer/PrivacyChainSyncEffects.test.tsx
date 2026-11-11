/** @jest-environment jsdom */
import { act, render, waitFor } from '@testing-library/react';

import type { IPrivacyChainScanState } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { PrivacyChainSyncEffects } from './PrivacyChainSyncEffects';

let mockState: IPrivacyChainScanState;
let mockStage: { step: string } | undefined;
let mockIsCellular = false;
let mockVaultSettings: { localWallet?: { syncedBelowBlocks?: number } } = {};
const mockActivate = jest.fn(async (_tag: string) => undefined);
const mockDeactivate = jest.fn(async (_tag: string) => undefined);
const mockLogError = jest.fn<void, [string]>();
const mockEventOn = jest.fn(
  (_event: string, _listener: () => void) => undefined,
);
const mockEventOff = jest.fn(
  (_event: string, _listener: () => void) => undefined,
);
const mockSetNetwork = jest.fn(
  async (_params: { isCellular: boolean | undefined }) => undefined,
);

jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: (tag: string) => mockActivate(tag),
  deactivateKeepAwake: (tag: string) => mockDeactivate(tag),
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    app: { error: { log: (message: string) => mockLogError(message) } },
  },
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
  appEventBus: {
    on: (event: string, listener: () => void) => mockEventOn(event, listener),
    off: (event: string, listener: () => void) => mockEventOff(event, listener),
  },
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
    },
    serviceNetwork: {
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

const nativeEnv = platformEnv as { isNative: boolean; isNativeIOS: boolean };

beforeEach(() => {
  jest.clearAllMocks();
  nativeEnv.isNative = false;
  nativeEnv.isNativeIOS = false;
  mockIsCellular = false;
  mockStage = undefined;
  mockVaultSettings = {};
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
    isBackfillComplete: scanned >= 1000,
    tipScannedHeight: scanned,
    chainTip: 1000,
    tipLag: 1000 - scanned,
    isTipCaughtUp: scanned >= 1000,
    isSyncing: scanned < 1000,
  };
}

it('keeps active scanning awake without mounting a floating UI', async () => {
  mockState.boostingNetworkIds = ['zec--0', 'xmr--0'];
  mockState.progress['zec--0:account'] = scanProgress(107);
  mockState.progress['xmr--0:account'] = scanProgress(400);
  const { container, unmount } = render(<PrivacyChainSyncEffects />);
  await waitFor(() =>
    expect(mockActivate).toHaveBeenCalledWith('privacy-chain-sync'),
  );
  expect(mockActivate).toHaveBeenCalledTimes(1);
  expect(container.childElementCount).toBe(0);
  unmount();
  expect(mockDeactivate).toHaveBeenCalledWith('privacy-chain-sync');
});

it('reports device network on mount, changes, and background readiness', async () => {
  const { rerender, unmount } = render(<PrivacyChainSyncEffects />);
  await act(async () => undefined);
  expect(mockSetNetwork).toHaveBeenLastCalledWith({ isCellular: false });
  const firstListener = mockEventOn.mock.calls[0][1];
  expect(mockEventOn).toHaveBeenCalledWith(
    EAppEventBusNames.BackgroundThreadReady,
    firstListener,
  );
  act(() => firstListener());
  expect(mockSetNetwork).toHaveBeenCalledTimes(2);

  mockIsCellular = true;
  rerender(<PrivacyChainSyncEffects />);
  expect(mockEventOff).toHaveBeenCalledWith(
    EAppEventBusNames.BackgroundThreadReady,
    firstListener,
  );
  expect(mockSetNetwork).toHaveBeenLastCalledWith({ isCellular: true });
  const currentListener = mockEventOn.mock.calls[1][1];
  act(() => currentListener());
  expect(mockSetNetwork).toHaveBeenLastCalledWith({ isCellular: true });
  unmount();
  expect(mockEventOff).toHaveBeenCalledWith(
    EAppEventBusNames.BackgroundThreadReady,
    currentListener,
  );
});

it('releases the wake lock when scanning pauses', async () => {
  mockState.boostingNetworkIds = ['zec--0'];
  mockState.progress['zec--0:account'] = scanProgress(107);
  const { rerender, container } = render(<PrivacyChainSyncEffects />);
  await act(async () => undefined);
  mockState = {
    ...mockState,
    boostingNetworkIds: [],
    pausedNetworkIds: ['zec--0'],
  };
  rerender(<PrivacyChainSyncEffects />);
  await act(async () => undefined);
  expect(mockDeactivate).toHaveBeenCalledWith('privacy-chain-sync');
  expect(container.childElementCount).toBe(0);
});

it('keeps the lock until every running network catches up', async () => {
  mockState.boostingNetworkIds = ['zec--0', 'xmr--0'];
  mockState.progress['zec--0:account'] = scanProgress(107);
  mockState.progress['xmr--0:account'] = scanProgress(400);
  const { rerender } = render(<PrivacyChainSyncEffects />);
  await act(async () => undefined);
  mockState.progress['zec--0:account'] = scanProgress(1000);
  rerender(<PrivacyChainSyncEffects />);
  expect(mockDeactivate).not.toHaveBeenCalled();
  mockState.progress['xmr--0:account'] = scanProgress(1000);
  rerender(<PrivacyChainSyncEffects />);
  expect(mockDeactivate).toHaveBeenCalledWith('privacy-chain-sync');
});

it('does not acquire a wake lock within the chain synced threshold', async () => {
  mockVaultSettings = { localWallet: { syncedBelowBlocks: 48 } };
  mockState.boostingNetworkIds = ['zec--threshold'];
  mockState.progress['zec--threshold:account'] = {
    ...scanProgress(990),
    backfillProgress: 1,
    isBackfillComplete: true,
  };
  render(<PrivacyChainSyncEffects />);
  expect(mockActivate).not.toHaveBeenCalled();
  await act(async () => undefined);
  expect(mockActivate).not.toHaveBeenCalled();
});

it.each(['paused', 'waitingWifi', 'storageUnsupported'] as const)(
  'does not keep an unavailable scan awake: %s',
  async (state) => {
    mockState.progress['zec--0:account'] = scanProgress(107);
    if (state === 'paused') mockState.pausedNetworkIds = ['zec--0'];
    if (state === 'waitingWifi') mockState.dataBlockedNetworkIds = ['zec--0'];
    if (state === 'storageUnsupported') {
      mockState.boostingNetworkIds = ['zec--0'];
      mockState.storageUnsupportedNetworkIds = ['zec--0'];
    }
    const { container } = render(<PrivacyChainSyncEffects />);
    await act(async () => undefined);
    expect(mockActivate).not.toHaveBeenCalled();
    expect(container.childElementCount).toBe(0);
  },
);

it('keeps network reporting active while the iOS hardware stage owns the screen', async () => {
  nativeEnv.isNative = true;
  nativeEnv.isNativeIOS = true;
  mockState.boostingNetworkIds = ['zec--0'];
  mockState.progress['zec--0:account'] = scanProgress(107);
  const { rerender, container } = render(<PrivacyChainSyncEffects />);
  await act(async () => undefined);
  expect(mockActivate).toHaveBeenCalledTimes(1);
  mockStage = { step: 'deviceChecking' };
  rerender(<PrivacyChainSyncEffects />);
  expect(mockDeactivate).toHaveBeenCalledTimes(1);
  expect(mockEventOff).not.toHaveBeenCalled();
  expect(container.childElementCount).toBe(0);
  mockStage = { step: 'off' };
  rerender(<PrivacyChainSyncEffects />);
  expect(mockActivate).toHaveBeenCalledTimes(2);
});

it('handles a refused wake lock without an unhandled rejection', async () => {
  mockActivate.mockRejectedValueOnce(new Error('Unavailable'));
  mockDeactivate.mockRejectedValueOnce(new Error('Unavailable'));
  mockState.boostingNetworkIds = ['zec--0'];
  mockState.progress['zec--0:account'] = scanProgress(107);
  const { unmount } = render(<PrivacyChainSyncEffects />);
  await waitFor(() =>
    expect(mockLogError).toHaveBeenCalledWith(
      'Privacy chain keep-awake unavailable',
    ),
  );
  unmount();
  await act(async () => undefined);
});
