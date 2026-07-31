import { type ReactTestRenderer, act, create } from 'react-test-renderer';

import { HomeDeFiStoreController } from './HomeDeFiStoreController';

type IDeFiCommand = {
  actionId: string;
  commandPayload?: unknown;
  intentId: string;
  sectionId: 'defi';
  sessionId: string;
  type: 'sectionActionInvoked' | 'sectionRefreshRequested';
};

type IDeFiNavigationValue =
  | { kind: 'hidden' }
  | {
      kind: 'ready';
      selectedTabId: 'defi' | 'portfolio';
      tabs: readonly ['portfolio', 'defi'];
    };

const mockRefresh = jest.fn(() => Promise.resolve());
const mockDispatchHomeDeFiSourceCommand = jest.fn<
  Promise<void>,
  [Record<string, unknown>]
>(() => Promise.resolve());
const mockMarkHomeSectionCommandHandled = jest.fn();
const mockRegisterHomeBackgroundRecoveryRefresh = jest.fn();
const mockUseHomeDeFiStoreSource = jest.fn<
  { refresh: typeof mockRefresh },
  [{ enabled: boolean; refreshCacheOnly: boolean; visible: boolean }]
>(() => ({ refresh: mockRefresh }));
let mockNavigationValue: IDeFiNavigationValue = {
  kind: 'ready',
  selectedTabId: 'portfolio',
  tabs: ['portfolio', 'defi'],
};
let mockPendingSectionCommands: IDeFiCommand[] = [];
const mockStableOwner = {
  ownerToken: {
    scopeKey: 'wallet-a:account-a',
    sessionId: 'session-a',
  },
};
const mockTestGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({
    activeAccount: {
      account: { id: 'account-a' },
      network: { id: 'network-a' },
      wallet: { id: 'wallet-a' },
    },
  }),
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/home', () => ({
  useHomeInteraction: () => ({
    pendingSectionCommands: mockPendingSectionCommands,
  }),
}));

jest.mock('../../pages/HomeBackgroundRecoveryRefreshProvider', () => ({
  EHomeBackgroundRecoveryRefreshDomain: { defi: 'defi' },
  useRegisterHomeBackgroundRecoveryRefresh: (
    params: Record<string, unknown>,
  ) => {
    mockRegisterHomeBackgroundRecoveryRefresh(params);
  },
}));

jest.mock('./homeDeFiIntents', () => ({
  HOME_DEFI_ACTION_IDS: {
    positionActionSucceeded: 'home.defi.positionActionSucceeded',
    refresh: 'home.defi.refresh',
  },
  dispatchHomeDeFiSourceCommand: (command: Record<string, unknown>) =>
    mockDispatchHomeDeFiSourceCommand(command),
}));

jest.mock('./homeStoreHooks', () => ({
  useHomeNavigationSnapshot: () => ({ value: mockNavigationValue }),
  useStableHomeFactsOwner: () => mockStableOwner,
}));

jest.mock('./useHomeDeFiStoreSource', () => ({
  useHomeDeFiStoreSource: (params: {
    enabled: boolean;
    refreshCacheOnly: boolean;
    visible: boolean;
  }) => mockUseHomeDeFiStoreSource(params),
}));

jest.mock('./useHomeStoreControllerActions', () => ({
  useHomeStoreControllerActions: () => ({
    markHomeSectionCommandHandled: mockMarkHomeSectionCommandHandled,
  }),
}));

beforeAll(() => {
  mockTestGlobal.IS_REACT_ACT_ENVIRONMENT = true;
});

afterAll(() => {
  delete mockTestGlobal.IS_REACT_ACT_ENVIRONMENT;
});

describe('HomeDeFiStoreController activation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigationValue = {
      kind: 'ready',
      selectedTabId: 'portfolio',
      tabs: ['portfolio', 'defi'],
    };
    mockPendingSectionCommands = [];
  });

  it('keeps the source active while only marking the selected DeFi tab visible', () => {
    let view!: ReactTestRenderer;
    act(() => {
      view = create(<HomeDeFiStoreController />);
    });

    expect(mockUseHomeDeFiStoreSource).toHaveBeenLastCalledWith({
      enabled: true,
      refreshCacheOnly: false,
      visible: false,
    });
    expect(mockRegisterHomeBackgroundRecoveryRefresh).toHaveBeenLastCalledWith({
      callback: mockRefresh,
      domain: 'defi',
      enabled: true,
      operationKey: 'home-defi-store-source',
      owner: {
        accountId: 'account-a',
        networkId: 'network-a',
        walletId: 'wallet-a',
      },
    });

    mockNavigationValue = {
      kind: 'ready',
      selectedTabId: 'defi',
      tabs: ['portfolio', 'defi'],
    };
    act(() => {
      view.update(<HomeDeFiStoreController />);
    });

    expect(mockUseHomeDeFiStoreSource).toHaveBeenLastCalledWith({
      enabled: true,
      refreshCacheOnly: false,
      visible: true,
    });

    mockNavigationValue = { kind: 'hidden' };
    act(() => {
      view.update(<HomeDeFiStoreController />);
    });

    expect(mockUseHomeDeFiStoreSource).toHaveBeenLastCalledWith({
      enabled: false,
      refreshCacheOnly: false,
      visible: false,
    });

    act(() => view.unmount());
  });

  it('refreshes and acknowledges a pending command for the current owner', async () => {
    mockPendingSectionCommands = [
      {
        actionId: 'home.defi.refresh',
        intentId: 'intent-refresh',
        sectionId: 'defi',
        sessionId: 'session-a',
        type: 'sectionRefreshRequested',
      },
    ];

    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(<HomeDeFiStoreController />);
      await Promise.resolve();
    });

    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(mockMarkHomeSectionCommandHandled).toHaveBeenCalledWith({
      intentId: 'intent-refresh',
      ownerToken: mockStableOwner.ownerToken,
    });

    act(() => view.unmount());
  });

  it('dispatches a valid position action payload before acknowledging it', async () => {
    const commandPayload = {
      accountId: 'account-a',
      data: [],
      networkId: 'network-a',
    };
    mockPendingSectionCommands = [
      {
        actionId: 'home.defi.positionActionSucceeded',
        commandPayload,
        intentId: 'intent-position',
        sectionId: 'defi',
        sessionId: 'session-a',
        type: 'sectionActionInvoked',
      },
    ];

    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(<HomeDeFiStoreController />);
      await Promise.resolve();
    });

    expect(mockDispatchHomeDeFiSourceCommand).toHaveBeenCalledWith({
      payload: commandPayload,
      type: 'positionActionSucceeded',
    });
    expect(mockMarkHomeSectionCommandHandled).toHaveBeenCalledWith({
      intentId: 'intent-position',
      ownerToken: mockStableOwner.ownerToken,
    });

    act(() => view.unmount());
  });
});
