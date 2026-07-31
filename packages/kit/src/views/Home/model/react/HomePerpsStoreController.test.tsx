import { type ReactTestRenderer, act, create } from 'react-test-renderer';

import { HomePerpsStoreController } from './HomePerpsStoreController';
import { isHomePerpsSourceActive } from './homePerpsStoreControllerPolicy';

const mockRefresh = jest.fn(() => Promise.resolve());
const mockMarkHomeSectionCommandHandled = jest.fn();
const mockRegisterHomeBackgroundRecoveryRefresh = jest.fn();
type IPerpsHomePortfolioParams = {
  isSourceActive: boolean;
  isSourceVisible: boolean;
};
const mockUsePerpsHomePortfolio = jest.fn<
  { refresh: typeof mockRefresh },
  [IPerpsHomePortfolioParams]
>(() => ({ refresh: mockRefresh }));
let mockNavigationValue:
  | { kind: 'hidden' }
  | {
      kind: 'ready';
      tabs: readonly ['portfolio', 'perps'];
      selectedTabId: 'portfolio' | 'perps';
    } = {
  kind: 'ready',
  tabs: ['portfolio', 'perps'],
  selectedTabId: 'portfolio',
};
let mockPendingSectionCommands: {
  actionId: string;
  intentId: string;
  sectionId: 'perps';
  sessionId: string;
  type: 'sectionRefreshRequested';
}[] = [];
const mockOwnerToken = {
  scopeKey: 'wallet-a:account-a',
  sessionId: 'session-a',
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
  useHomeFacts: () => ({ ownerToken: mockOwnerToken }),
  useHomeInteraction: () => ({
    pendingSectionCommands: mockPendingSectionCommands,
  }),
  useHomeNavigation: () => ({ value: mockNavigationValue }),
}));

jest.mock('../../pages/HomeBackgroundRecoveryRefreshProvider', () => ({
  EHomeBackgroundRecoveryRefreshDomain: { perps: 'perps' },
  useRegisterHomeBackgroundRecoveryRefresh: (
    params: Record<string, unknown>,
  ) => {
    mockRegisterHomeBackgroundRecoveryRefresh(params);
  },
}));

jest.mock('../../pages/usePerpsHomePortfolio', () => ({
  usePerpsHomePortfolio: (params: IPerpsHomePortfolioParams) =>
    mockUsePerpsHomePortfolio(params),
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

describe('HomePerpsStoreController ownership', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigationValue = {
      kind: 'ready',
      tabs: ['portfolio', 'perps'],
      selectedTabId: 'portfolio',
    };
    mockPendingSectionCommands = [];
  });

  it('activates the source whenever Store exposes the Perps contributor', () => {
    expect(isHomePerpsSourceActive({ kind: 'hidden' })).toBe(false);
    expect(
      isHomePerpsSourceActive({
        kind: 'ready',
        tabs: ['portfolio', 'perps'],
        selectedTabId: 'portfolio',
      }),
    ).toBe(true);
    expect(
      isHomePerpsSourceActive({
        kind: 'ready',
        tabs: ['portfolio', 'perps'],
        selectedTabId: 'perps',
      }),
    ).toBe(true);
  });

  it('keeps the producer active while only marking the visible tab as visible', () => {
    let view!: ReactTestRenderer;
    act(() => {
      view = create(<HomePerpsStoreController />);
    });

    expect(mockUsePerpsHomePortfolio).toHaveBeenLastCalledWith({
      isSourceActive: true,
      isSourceVisible: false,
    });
    expect(mockRegisterHomeBackgroundRecoveryRefresh).toHaveBeenLastCalledWith({
      callback: mockRefresh,
      domain: 'perps',
      operationKey: 'home-perps-store-source',
      owner: {
        accountId: 'account-a',
        networkId: 'network-a',
        walletId: 'wallet-a',
      },
    });

    mockNavigationValue = {
      kind: 'ready',
      tabs: ['portfolio', 'perps'],
      selectedTabId: 'perps',
    };
    act(() => {
      view.update(<HomePerpsStoreController />);
    });

    expect(mockUsePerpsHomePortfolio).toHaveBeenLastCalledWith({
      isSourceActive: true,
      isSourceVisible: true,
    });

    act(() => view.unmount());
  });

  it('handles a pending refresh command and acknowledges its owner session', async () => {
    mockPendingSectionCommands = [
      {
        actionId: 'home.perps.refresh',
        intentId: 'intent-a',
        sectionId: 'perps',
        sessionId: 'session-a',
        type: 'sectionRefreshRequested',
      },
    ];

    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(<HomePerpsStoreController />);
      await Promise.resolve();
    });

    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(mockMarkHomeSectionCommandHandled).toHaveBeenCalledWith({
      intentId: 'intent-a',
      ownerToken: mockOwnerToken,
    });

    act(() => view.unmount());
  });
});
