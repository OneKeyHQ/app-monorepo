/** @jest-environment jsdom */

import { renderHook, waitFor } from '@testing-library/react';

import { useAutoSelectDeriveType } from './useAutoSelectDeriveType';

type IGlobalSyncResult = {
  globalDeriveType: string | undefined;
  selectionResult: { outcome: string } | undefined;
};

type IGlobalDeriveTypeListener = (payload: unknown) => void;

const mockSyncLocalDeriveTypeFromGlobal: jest.MockedFunction<
  (params: unknown) => Promise<IGlobalSyncResult>
> = jest.fn();
const mockAppEventBusOn: jest.MockedFunction<
  (name: string, fn: IGlobalDeriveTypeListener) => void
> = jest.fn();
const mockAppEventBusOff: jest.MockedFunction<
  (name: string, fn: IGlobalDeriveTypeListener) => void
> = jest.fn();
const mockGetSelectedAccount: jest.MockedFunction<
  () => { deriveType: string | undefined; networkId: string | undefined }
> = jest.fn();
const mockUpdateSelectedAccountDeriveType: jest.MockedFunction<
  (params: unknown) => Promise<{ outcome: string }>
> = jest.fn();
const mockGetDeriveInfoItemsOfNetwork: jest.MockedFunction<
  () => Promise<{ value: string }[]>
> = jest.fn();
const mockGetDeriveTypeOrFallbackToGlobal: jest.MockedFunction<
  () => Promise<string | undefined>
> = jest.fn();
const mockAccountSelectorActions = {
  current: {
    getSelectedAccount: () => mockGetSelectedAccount(),
    syncLocalDeriveTypeFromGlobal: (params: unknown) =>
      mockSyncLocalDeriveTypeFromGlobal(params),
    updateSelectedAccountDeriveType: (params: unknown) =>
      mockUpdateSelectedAccountDeriveType(params),
  },
};

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: { GlobalDeriveTypeUpdate: 'GlobalDeriveTypeUpdate' },
  appEventBus: {
    off: (name: string, fn: (payload: unknown) => void) =>
      mockAppEventBusOff(name, fn),
    on: (name: string, fn: (payload: unknown) => void) =>
      mockAppEventBusOn(name, fn),
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => {
  const noopLogger: unknown = new Proxy(jest.fn(), {
    apply: () => undefined,
    get: () => noopLogger,
  });
  return { defaultLogger: noopLogger };
});

jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceNetwork: {
      getDeriveInfoItemsOfNetwork: () => mockGetDeriveInfoItemsOfNetwork(),
      getDeriveTypeOrFallbackToGlobal: () =>
        mockGetDeriveTypeOrFallbackToGlobal(),
    },
  },
}));

// Mutable so a test can move the active network and rerender, driving the
// main effect's networkId dependency the way a real network switch does.
let mockActiveNetworkId = 'evm--1';
let mockActiveDeriveInfo: { value: string } | undefined;

jest.mock('../../../states/jotai/contexts/accountSelector', () => ({
  useAccountSelectorSceneInfo: () => ({
    sceneName: 'home',
    sceneUrl: undefined,
  }),
  useAccountSelectorStorageReadyAtom: () => [true],
  useActiveAccount: () => ({
    activeAccount: {
      deriveInfo: mockActiveDeriveInfo,
      isOthersWallet: false,
      network: { id: mockActiveNetworkId },
    },
  }),
}));

jest.mock('../../../states/jotai/contexts/accountSelector/actions', () => ({
  useAccountSelectorActions: () => mockAccountSelectorActions,
}));

jest.mock('../../../states/jotai/contexts/accountSelector/perfDebug', () => ({
  getAccountSelectorPerfTimestamp: () => 0,
  getNextAccountSelectorPerfOperationId: () => 1,
  isAccountSelectorPerfDebugEnabled: () => false,
}));

function getLastGlobalDeriveTypeListener() {
  const listener = mockAppEventBusOn.mock.calls
    .filter(([name]) => name === 'GlobalDeriveTypeUpdate')
    .at(-1)?.[1];
  expect(listener).toBeDefined();
  return listener;
}

// The first effect fires one sync on mount; drop it so assertions below only
// see the syncs triggered by the global event listener.
async function mountAndSettleInitialSync() {
  const rendered = renderHook(() => useAutoSelectDeriveType({ num: 0 }));
  await waitFor(() => {
    expect(mockSyncLocalDeriveTypeFromGlobal).toHaveBeenCalled();
  });
  mockSyncLocalDeriveTypeFromGlobal.mockClear();
  return rendered;
}

describe('useAutoSelectDeriveType global sync outcome', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockActiveNetworkId = 'evm--1';
    mockActiveDeriveInfo = undefined;
    mockGetDeriveInfoItemsOfNetwork.mockResolvedValue([{ value: 'default' }]);
    mockGetDeriveTypeOrFallbackToGlobal.mockResolvedValue('default');
    mockUpdateSelectedAccountDeriveType.mockResolvedValue({
      outcome: 'commit',
    });
  });

  it('falls back when the global sync went stale and no derive type landed', async () => {
    mockSyncLocalDeriveTypeFromGlobal.mockResolvedValue({
      globalDeriveType: 'default',
      selectionResult: { outcome: 'stale' },
    });
    mockGetSelectedAccount.mockReturnValue({
      deriveType: undefined,
      networkId: 'evm--1',
    });

    renderHook(() => useAutoSelectDeriveType({ num: 0 }));

    await waitFor(() => {
      expect(mockUpdateSelectedAccountDeriveType).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'autoDeriveFallback' }),
      );
    });
  });

  it('leaves a newer derive type alone when the global sync went stale', async () => {
    mockSyncLocalDeriveTypeFromGlobal.mockResolvedValue({
      globalDeriveType: 'default',
      selectionResult: { outcome: 'stale' },
    });
    mockGetSelectedAccount.mockReturnValue({
      deriveType: 'ledgerLive',
      networkId: 'evm--1',
    });

    renderHook(() => useAutoSelectDeriveType({ num: 0 }));

    await waitFor(() => {
      expect(mockSyncLocalDeriveTypeFromGlobal).toHaveBeenCalled();
    });
    expect(mockUpdateSelectedAccountDeriveType).not.toHaveBeenCalled();
  });

  it('stops after a global sync that actually landed', async () => {
    mockSyncLocalDeriveTypeFromGlobal.mockResolvedValue({
      globalDeriveType: 'default',
      selectionResult: { outcome: 'commit' },
    });
    mockGetSelectedAccount.mockReturnValue({
      deriveType: 'default',
      networkId: 'evm--1',
    });

    renderHook(() => useAutoSelectDeriveType({ num: 0 }));

    await waitFor(() => {
      expect(mockSyncLocalDeriveTypeFromGlobal).toHaveBeenCalled();
    });
    expect(mockUpdateSelectedAccountDeriveType).not.toHaveBeenCalled();
  });
});

describe('useAutoSelectDeriveType global derive type event', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockActiveNetworkId = 'evm--1';
    mockActiveDeriveInfo = undefined;
    mockSyncLocalDeriveTypeFromGlobal.mockResolvedValue({
      globalDeriveType: 'default',
      selectionResult: { outcome: 'commit' },
    });
    mockGetSelectedAccount.mockReturnValue({
      deriveType: 'default',
      networkId: 'evm--1',
    });
  });

  it('syncs when the event impl matches the active network impl', async () => {
    await mountAndSettleInitialSync();

    getLastGlobalDeriveTypeListener()?.({ networkImpl: 'evm' });

    await waitFor(() => {
      expect(mockSyncLocalDeriveTypeFromGlobal).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'global-event' }),
      );
    });
  });

  it('ignores the event when the impl belongs to another network', async () => {
    await mountAndSettleInitialSync();

    getLastGlobalDeriveTypeListener()?.({ networkImpl: 'btc' });

    expect(mockSyncLocalDeriveTypeFromGlobal).not.toHaveBeenCalled();
  });

  it('still syncs when the event carries no usable impl', async () => {
    await mountAndSettleInitialSync();

    const listener = getLastGlobalDeriveTypeListener();
    listener?.(undefined);
    listener?.({});
    listener?.({ networkImpl: 123 });

    await waitFor(() => {
      expect(mockSyncLocalDeriveTypeFromGlobal).toHaveBeenCalledTimes(3);
    });
    expect(mockSyncLocalDeriveTypeFromGlobal).toHaveBeenLastCalledWith(
      expect.objectContaining({ source: 'global-event' }),
    );
  });

  it('does not retry a stale event sync; a network change re-syncs instead', async () => {
    // The event sync is a level-triggered reconciliation with no retry by
    // design: every change that can drop it as stale ships its own successor.
    // This locks both halves: no second sync fires for the stale result, and
    // the networkId dependency of the main effect issues the fresh one.
    const rendered = await mountAndSettleInitialSync();
    mockSyncLocalDeriveTypeFromGlobal.mockResolvedValue({
      globalDeriveType: 'default',
      selectionResult: { outcome: 'stale' },
    });

    getLastGlobalDeriveTypeListener()?.({ networkImpl: 'evm' });
    await waitFor(() => {
      expect(mockSyncLocalDeriveTypeFromGlobal).toHaveBeenCalledTimes(1);
    });
    // Let any hypothetical retry win its microtask/timer race before asserting.
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(mockSyncLocalDeriveTypeFromGlobal).toHaveBeenCalledTimes(1);

    mockActiveNetworkId = 'btc--0';
    rendered.rerender();
    await waitFor(() => {
      expect(mockSyncLocalDeriveTypeFromGlobal).toHaveBeenCalledTimes(2);
    });
    expect(mockSyncLocalDeriveTypeFromGlobal).toHaveBeenLastCalledWith(
      expect.objectContaining({ source: 'network-change' }),
    );
  });

  it('does not repeat the global RPC when only derive info is rebuilt', async () => {
    const rendered = await mountAndSettleInitialSync();
    mockSyncLocalDeriveTypeFromGlobal.mockClear();

    mockActiveDeriveInfo = { value: 'default' };
    rendered.rerender();
    await Promise.resolve();

    expect(mockSyncLocalDeriveTypeFromGlobal).not.toHaveBeenCalled();
  });

  it('runs the fallback without repeating the global RPC when derive info disappears', async () => {
    mockActiveDeriveInfo = { value: 'default' };
    mockGetSelectedAccount.mockReturnValue({
      deriveType: undefined,
      networkId: 'evm--1',
    });
    const rendered = await mountAndSettleInitialSync();
    mockSyncLocalDeriveTypeFromGlobal.mockClear();
    mockUpdateSelectedAccountDeriveType.mockClear();

    mockActiveDeriveInfo = undefined;
    rendered.rerender();

    await waitFor(() => {
      expect(mockUpdateSelectedAccountDeriveType).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'autoDeriveFallback' }),
      );
    });
    expect(mockSyncLocalDeriveTypeFromGlobal).not.toHaveBeenCalled();
  });

  it('removes the listener on unmount', async () => {
    const { unmount } = await mountAndSettleInitialSync();
    const listener = getLastGlobalDeriveTypeListener();

    unmount();

    expect(mockAppEventBusOff).toHaveBeenCalledWith(
      'GlobalDeriveTypeUpdate',
      listener,
    );
  });
});
