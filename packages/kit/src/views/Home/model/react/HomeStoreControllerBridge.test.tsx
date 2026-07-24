import {
  type ReactNode,
  StrictMode,
  createElement,
  useLayoutEffect,
} from 'react';

import { type ReactTestRenderer, act, create } from 'react-test-renderer';

import {
  type IPreparedHomeDisplaySnapshot,
  loadPreparedHomeDisplaySnapshot,
} from '../cacheV2/loadPreparedHomeDisplaySnapshot';

import { HomeStoreControllerBridge } from './HomeStoreControllerBridge';

const mockEvents: string[] = [];
const mockControllerLeaseKey = () => undefined;
const mockLoadPreparedHomeDisplaySnapshot = jest.mocked(
  loadPreparedHomeDisplaySnapshot,
);
let mockActiveAccount = {
  account: { id: 'account-a' },
  network: {
    id: 'network-a',
    impl: 'evm',
    isAllNetworks: false,
  },
  ready: true,
  wallet: {
    id: 'wallet-a',
    backuped: true,
    type: 'hd',
  },
};
let mockSessionId = 0;
let mockOwner:
  | {
      accountId: string;
      network:
        | { kind: 'allNetworks' }
        | { kind: 'singleNetwork'; networkId: string };
      walletId: string;
    }
  | undefined;

const mockCoordinator = {
  connectCurrent: jest.fn(async () => {
    mockEvents.push('connect');
  }),
  getSnapshot: jest.fn(() => ({
    ownerToken: mockOwner
      ? {
          scopeKey: `${mockOwner.walletId}:${mockOwner.accountId}`,
          sessionId: `session-${mockSessionId}`,
        }
      : undefined,
    revision: mockSessionId,
    status: mockOwner ? ('waitingForProducer' as const) : ('idle' as const),
    topology: 'split' as const,
  })),
  refreshHandshake: jest.fn(async () => undefined),
  restartCurrent: jest.fn(),
  setOwner: jest.fn(
    (
      owner:
        | {
            accountId: string;
            network:
              | { kind: 'allNetworks' }
              | { kind: 'singleNetwork'; networkId: string };
            walletId: string;
          }
        | undefined,
    ) => {
      mockEvents.push(`set-owner:${owner?.walletId ?? 'none'}`);
      mockOwner = owner;
      mockSessionId += 1;
    },
  ),
  stop: jest.fn(() => {
    mockEvents.push('stop-coordinator');
    mockOwner = undefined;
  }),
  subscribe: jest.fn(() => {
    mockEvents.push('subscribe');
    return () => {
      mockEvents.push('unsubscribe');
    };
  }),
};

const mockControllerActions = {
  controllerLeaseKey: mockControllerLeaseKey,
  publishHomeFactsChanged: jest.fn(() => {
    mockEvents.push('publish-facts');
  }),
  publishHomeOwnerChanged: jest.fn(() => {
    mockEvents.push('publish-owner');
  }),
  publishHomeRuntimeChanged: jest.fn(() => {
    mockEvents.push('publish-runtime');
  }),
  publishPreparedHomeOwner: jest.fn(() => {
    mockEvents.push('publish-prepared-owner');
  }),
  stopHomeStore: jest.fn(() => {
    mockEvents.push('stop-store');
  }),
};

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceBootstrap: {
      getHomeRuntimeHandshake: jest.fn(),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({
    activeAccount: mockActiveAccount,
  }),
}));

jest.mock(
  '@onekeyhq/shared/src/background/nativeBackgroundThreadReady',
  () => ({
    onNativeBackgroundThreadReady: jest.fn(() => undefined),
  }),
);

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isExtension: false,
    isNative: false,
  },
}));

jest.mock('../core/homeIdentity', () => ({
  buildHomeOwnerScopeKey: ({
    accountId,
    walletId,
  }: {
    accountId: string;
    walletId: string;
  }) => `${walletId}:${accountId}`,
}));

jest.mock('../facts/currentHomeFactsAdapter', () => ({
  adaptCurrentHomeFacts: jest.fn(() => undefined),
}));

jest.mock('../cacheV2/loadPreparedHomeDisplaySnapshot', () => ({
  loadPreparedHomeDisplaySnapshot: jest.fn(async () => undefined),
}));

jest.mock('../lifecycle/homeSessionCoordinator', () => ({
  HomeSessionCoordinator: jest.fn(() => mockCoordinator),
}));

jest.mock('../runtime/singleRuntimeHomeAdapter', () => ({
  SingleRuntimeHomeAdapter: jest.fn(),
}));

jest.mock('./homeStoreControllerLease', () => ({
  acquireHomeStoreControllerLease: jest.fn(() => {
    mockEvents.push('acquire-lease');
    return () => {
      mockEvents.push('release-lease');
    };
  }),
}));

jest.mock('./useHomeStoreControllerActions', () => ({
  useHomeStoreControllerActions: () => mockControllerActions,
}));

const mockTestGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

function LayoutProbe({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    mockEvents.push('layout-complete');
  }, []);
  return createElement(StrictMode, undefined, children);
}

beforeAll(() => {
  mockTestGlobal.IS_REACT_ACT_ENVIRONMENT = true;
});

afterAll(() => {
  delete mockTestGlobal.IS_REACT_ACT_ENVIRONMENT;
});

beforeEach(() => {
  mockEvents.length = 0;
  mockActiveAccount = {
    account: { id: 'account-a' },
    network: {
      id: 'network-a',
      impl: 'evm',
      isAllNetworks: false,
    },
    ready: true,
    wallet: {
      id: 'wallet-a',
      backuped: true,
      type: 'hd',
    },
  };
  mockOwner = undefined;
  mockSessionId = 0;
  jest.clearAllMocks();
  mockLoadPreparedHomeDisplaySnapshot.mockResolvedValue(undefined);
});

describe('HomeStoreControllerBridge effects', () => {
  it('acquires the controller lease before local authority work and connects after layout', async () => {
    let view!: ReactTestRenderer;
    await act(async () => {
      view = create(
        <LayoutProbe>
          <HomeStoreControllerBridge />
        </LayoutProbe>,
      );
      await Promise.resolve();
    });

    expect(mockEvents.indexOf('acquire-lease')).toBeLessThan(
      mockEvents.indexOf('subscribe'),
    );
    expect(mockEvents.indexOf('acquire-lease')).toBeLessThan(
      mockEvents.indexOf('set-owner:wallet-a'),
    );
    expect(mockEvents.indexOf('acquire-lease')).toBeLessThan(
      mockEvents.indexOf('publish-owner'),
    );
    expect(mockEvents.indexOf('publish-owner')).toBeLessThan(
      mockEvents.indexOf('layout-complete'),
    );
    expect(mockEvents.indexOf('layout-complete')).toBeLessThan(
      mockEvents.indexOf('connect'),
    );

    act(() => view.unmount());
    expect(
      mockEvents.filter((event) => event === 'release-lease'),
    ).toHaveLength(
      mockEvents.filter((event) => event === 'acquire-lease').length,
    );
  });

  it('releases and reacquires authority around an owner change', async () => {
    let view!: ReactTestRenderer;
    const render = () => <HomeStoreControllerBridge />;
    await act(async () => {
      view = create(render());
      await Promise.resolve();
    });

    mockEvents.length = 0;
    mockActiveAccount = {
      ...mockActiveAccount,
      account: { id: 'account-b' },
      wallet: {
        ...mockActiveAccount.wallet,
        id: 'wallet-b',
      },
    };
    await act(async () => {
      view.update(render());
      await Promise.resolve();
    });

    expect(mockEvents).toEqual(
      expect.arrayContaining([
        'unsubscribe',
        'stop-coordinator',
        'release-lease',
        'acquire-lease',
        'subscribe',
        'set-owner:wallet-b',
        'connect',
      ]),
    );
    expect(mockEvents.indexOf('release-lease')).toBeLessThan(
      mockEvents.indexOf('acquire-lease'),
    );
    expect(mockEvents.indexOf('acquire-lease')).toBeLessThan(
      mockEvents.indexOf('set-owner:wallet-b'),
    );

    act(() => view.unmount());
  });

  it('keeps the published owner until the replacement cache probe completes', async () => {
    let view!: ReactTestRenderer;
    const render = () => <HomeStoreControllerBridge />;
    await act(async () => {
      view = create(render());
      await Promise.resolve();
    });

    let resolvePrepared:
      | ((value: IPreparedHomeDisplaySnapshot | undefined) => void)
      | undefined;
    mockLoadPreparedHomeDisplaySnapshot.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePrepared = resolve;
        }),
    );
    mockEvents.length = 0;
    mockActiveAccount = {
      ...mockActiveAccount,
      account: { id: 'account-b' },
      wallet: {
        ...mockActiveAccount.wallet,
        id: 'wallet-b',
      },
    };
    await act(async () => {
      view.update(render());
      await Promise.resolve();
    });

    expect(mockEvents).not.toContain('publish-owner');
    expect(mockEvents).not.toContain('publish-prepared-owner');

    await act(async () => {
      resolvePrepared?.({ records: [] });
      await Promise.resolve();
    });

    expect(mockEvents).toContain('publish-prepared-owner');
    expect(mockEvents).not.toContain('publish-owner');
    act(() => view.unmount());
  });
});
