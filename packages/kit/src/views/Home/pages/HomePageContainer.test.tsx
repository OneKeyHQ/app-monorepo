import type { ReactNode } from 'react';

import { type ReactTestRenderer, act, create } from 'react-test-renderer';

import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { HomeLaunchGatedContent, HomePageContainer } from './HomePageContainer';

type IMockWallet = {
  id: string;
  type: string;
  backuped?: boolean;
};

type IMockSurfaceName = 'empty' | 'native' | 'react';

const mockSurfaceLifecycle: Record<
  IMockSurfaceName,
  { mounts: number; unmounts: number }
> = {
  empty: { mounts: 0, unmounts: 0 },
  native: { mounts: 0, unmounts: 0 },
  react: { mounts: 0, unmounts: 0 },
};

let mockActiveAccount: {
  ready: boolean;
  wallet?: IMockWallet;
  account?: { id: string };
  network?: { id: string };
};
let mockWalletList: {
  pending: boolean;
  result?: { wallets: IMockWallet[] };
};
let mockLaunchSnapshot: {
  decision: 'unknown' | 'onboarding' | 'main';
  readyHomeGeneration: number;
  requiredHomeGeneration: number;
};
let mockAccountSelectorStorageInitDone: boolean;
let mockActiveAccountInitDone: boolean;
let mockRootControllerMounts = 0;
const mockSceneStore = {};
let mockHomeProviderStore: unknown;
let mockHomeShellKind: 'loading' | 'backupRequired' | 'portfolio' = 'loading';
let mockHomePresentationKind: 'funded' | 'fundedPendingTotal' = 'funded';
let mockHomeSession: {
  owner?: {
    accountId: string;
    network:
      | { kind: 'allNetworks' }
      | { kind: 'singleNetwork'; networkId: string };
    walletId: string;
  };
  ownerToken?: { scopeKey: string; sessionId: string };
};
let mockDisplaySnapshotLoadState:
  | { status: 'idle' }
  | {
      ownerScopeKey: string;
      sessionId: string;
      status: 'loading' | 'hit' | 'miss';
    };
const mockTestGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
  __homePageContainerIsNative?: boolean;
};

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    Stack: ({ children, ...props }: { children?: ReactNode }) =>
      React.createElement('View', props, children),
    useIsDesktopModeUIInTabPages: () => false,
  };
});

jest.mock(
  '@onekeyhq/kit/src/views/DAppConnection/components/DAppConnectExtensionFloatingTrigger',
  () => () => null,
);

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  EJotaiContextStoreNames: { homeAccountOverview: 'homeAccountOverview' },
  useDevSettingsPersistAtom: () => [
    {
      enabled: false,
      settings: {},
    },
  ],
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isNative() {
      return (
        (
          globalThis as typeof globalThis & {
            __homePageContainerIsNative?: boolean;
          }
        ).__homePageContainerIsNative ?? true
      );
    },
  },
}));

jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  __esModule: true,
  default: {
    hasNoUsableWallet: ({ wallet }: { wallet?: IMockWallet }) => !wallet,
    isWalletDeprecatedOrMocked: () => false,
  },
}));

jest.mock('@onekeyhq/shared/src/utils/debug/debugUtils', () => ({
  useDebugComponentRemountLog: () => undefined,
}));

jest.mock('../../../components/AccountSelector', () => ({
  AccountSelectorProviderMirror: ({ children }: { children?: ReactNode }) =>
    children,
}));

jest.mock('../../../components/OneKeyAuth/ExtOneKeyIdAuthOnMount', () => ({
  ExtOneKeyIdAuthOnMount: () => null,
}));

jest.mock('../../../components/TabletHomeContainer', () => ({
  TabletHomeContainer: ({ children }: { children?: ReactNode }) => children,
}));

jest.mock('../../../states/jotai/contexts/accountOverview', () => ({
  ProviderJotaiContextAccountOverview: ({
    children,
  }: {
    children?: ReactNode;
  }) => children,
}));

jest.mock('../../../states/jotai/contexts/home', () => ({
  ProviderJotaiContextHome: ({
    children,
    store,
  }: {
    children?: ReactNode;
    store?: unknown;
  }) => {
    mockHomeProviderStore = store;
    return children;
  },
  useHomeShell: () => ({
    value:
      mockHomeShellKind === 'portfolio'
        ? {
            kind: 'portfolio',
            presentation: { kind: mockHomePresentationKind },
          }
        : { kind: mockHomeShellKind },
  }),
  useHomeSessionState: () => mockHomeSession,
  useHomeDisplaySnapshotLoadState: () => mockDisplaySnapshotLoadState,
  useHomeNavigation: () => ({
    value: { kind: 'ready', selectedTabId: 'portfolio' },
  }),
  useHomeSection: () => ({ value: { kind: 'ready' } }),
}));

jest.mock('../../../states/jotai/contexts/accountSelector', () => ({
  useAccountSelectorStorageInitDoneAtom: () => [
    mockAccountSelectorStorageInitDone,
  ],
  useActiveAccount: () => ({ activeAccount: mockActiveAccount }),
  useIsAccountSelectorActiveAccountInitDone: () => mockActiveAccountInitDone,
  useSelectedAccount: () => ({ selectedAccount: undefined }),
  useSelectedAccountsAtom: () => [undefined],
}));

jest.mock('../../../states/jotai/utils/useJotaiContextRootStore', () => ({
  useJotaiContextRootStore: () => mockSceneStore,
}));

jest.mock('../../Notifications/components/NotificationRegisterDaily', () => ({
  NotificationRegisterDaily: () => null,
}));

jest.mock('../../Onboarding/components/onboardingLaunchGate', () => ({
  markCurrentHomeGenerationReady: jest.fn(),
  useOnboardingLaunchSnapshot: () => mockLaunchSnapshot,
}));

jest.mock('../../Setting/pages/Protection/KYTIntroDialog', () => ({
  KYTIntroOnMount: () => null,
}));

jest.mock('../components/BTCFreshAddressProvider', () => ({
  BTCFreshAddressProvider: () => null,
}));

jest.mock(
  '../components/HomeTokenListProvider/HomeTokenListRootProvider',
  () => ({
    useHomeTokenListContextStoreInitData: () => ({
      storeName: 'homeTokenList',
    }),
  }),
);

jest.mock('../nativeHomeFeatureFlag', () => ({
  isNativeHomeEnabled: () => true,
}));

jest.mock('../model/react/HomeStoreSourceControllers', () => ({
  HomeStoreSourceControllers: () => {
    mockRootControllerMounts += 1;
    return null;
  },
}));

function mockCreateSurface(name: IMockSurfaceName) {
  const React = jest.requireActual<typeof import('react')>('react');
  return function MockSurface() {
    React.useEffect(() => {
      mockSurfaceLifecycle[name].mounts += 1;
      return () => {
        mockSurfaceLifecycle[name].unmounts += 1;
      };
    }, []);
    return React.createElement(
      'View',
      { testID: `surface-${name}` },
      name === 'empty'
        ? React.createElement('View', { testID: 'empty-wallet-cta' })
        : null,
    );
  };
}

jest.mock('../NativeHomePageView', () => ({
  NativeHomePageView: mockCreateSurface('native'),
}));

jest.mock('./EmptyWalletHomePage', () => ({
  EmptyWalletHomePage: mockCreateSurface('empty'),
}));

jest.mock('./HomePageViewLoader', () => ({
  HomePageView: mockCreateSurface('react'),
}));

jest.mock('./HomeLaunchSkeleton', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    HomeLaunchSkeleton: () =>
      React.createElement('View', { testID: 'home-launch-skeleton' }),
  };
});

jest.mock('./HomeWalletListProvider', () => ({
  HomeWalletListProvider: ({ children }: { children?: ReactNode }) => children,
  useHomeWalletList: () => mockWalletList,
}));

const hdWallet = (backuped: boolean, id = 'hd-1'): IMockWallet => ({
  id,
  type: 'hd',
  backuped,
});

function setWalletState({
  activeWallet,
  walletListWallet,
  pending = false,
}: {
  activeWallet?: IMockWallet;
  walletListWallet?: IMockWallet;
  pending?: boolean;
}) {
  mockActiveAccount = {
    ready: true,
    wallet: activeWallet,
    account: activeWallet ? { id: `account-${activeWallet.id}` } : undefined,
    network: activeWallet ? { id: 'evm--1' } : undefined,
  };
  mockWalletList = {
    pending,
    result: pending
      ? undefined
      : { wallets: walletListWallet ? [walletListWallet] : [] },
  };
  if (activeWallet) {
    const accountId = `account-${activeWallet.id}`;
    const scopeKey = `scope-${activeWallet.id}`;
    const sessionId = `session-${activeWallet.id}`;
    mockHomeSession = {
      owner: {
        accountId,
        network: { kind: 'singleNetwork', networkId: 'evm--1' },
        walletId: activeWallet.id,
      },
      ownerToken: { scopeKey, sessionId },
    };
    mockDisplaySnapshotLoadState = {
      ownerScopeKey: scopeKey,
      sessionId,
      status: 'hit',
    };
  } else {
    mockHomeSession = {};
    mockDisplaySnapshotLoadState = { status: 'idle' };
  }
  if (activeWallet?.type === 'hd' && activeWallet.backuped === false) {
    mockHomeShellKind = 'backupRequired';
  } else if (activeWallet) {
    mockHomeShellKind = 'portfolio';
  } else {
    mockHomeShellKind = 'loading';
  }
}

function renderOwner(nativeHomeEnabled = true) {
  return (
    <HomeLaunchGatedContent
      nativeHomeEnabled={nativeHomeEnabled}
      sceneName={EAccountSelectorSceneName.home}
      onPressHide={jest.fn()}
    />
  );
}

function resetSurfaceLifecycle() {
  Object.values(mockSurfaceLifecycle).forEach((state) => {
    state.mounts = 0;
    state.unmounts = 0;
  });
}

beforeEach(() => {
  resetSurfaceLifecycle();
  mockActiveAccount = { ready: false };
  mockWalletList = { pending: true };
  mockLaunchSnapshot = {
    decision: 'main',
    readyHomeGeneration: 0,
    requiredHomeGeneration: 1,
  };
  mockAccountSelectorStorageInitDone = true;
  mockActiveAccountInitDone = true;
  mockRootControllerMounts = 0;
  mockHomeProviderStore = undefined;
  mockHomeShellKind = 'loading';
  mockHomePresentationKind = 'funded';
  mockHomeSession = {};
  mockDisplaySnapshotLoadState = { status: 'idle' };
  mockTestGlobal.__homePageContainerIsNative = true;
});

describe('HomePageContainer Unified Store integration', () => {
  it('mounts Store controllers without selecting a visible surface', () => {
    let view!: ReactTestRenderer;
    act(() => {
      view = create(<HomePageContainer />);
    });
    expect(mockRootControllerMounts).toBe(1);
    expect(mockHomeProviderStore).toBe(mockSceneStore);
    expect(view.root.findAllByProps({ testID: 'surface-empty' })).toHaveLength(
      0,
    );
    expect(view.root.findAllByProps({ testID: 'surface-native' })).toHaveLength(
      0,
    );
    expect(view.root.findAllByProps({ testID: 'surface-react' })).toHaveLength(
      0,
    );
    act(() => view.unmount());
  });
});

beforeAll(() => {
  mockTestGlobal.IS_REACT_ACT_ENVIRONMENT = true;
});

afterAll(() => {
  delete mockTestGlobal.IS_REACT_ACT_ENVIRONMENT;
  delete mockTestGlobal.__homePageContainerIsNative;
});

describe('HomeLaunchGatedContent surface ownership', () => {
  it('uses the local launch decision on non-native Home without waiting for BG', () => {
    mockTestGlobal.__homePageContainerIsNative = false;
    mockLaunchSnapshot.decision = 'unknown';
    const backedUp = hdWallet(true);
    setWalletState({ activeWallet: backedUp, walletListWallet: backedUp });

    let view!: ReactTestRenderer;
    act(() => {
      view = create(renderOwner(false));
    });

    expect(
      view.root.findAllByProps({ testID: 'home-launch-skeleton' }),
    ).toHaveLength(1);
    expect(view.root.findAllByProps({ testID: 'surface-react' })).toHaveLength(
      0,
    );

    mockLaunchSnapshot.decision = 'main';
    act(() => view.update(renderOwner(false)));

    expect(view.root.findAllByProps({ testID: 'surface-react' })).toHaveLength(
      1,
    );
    expect(mockSurfaceLifecycle.native.mounts).toBe(0);
    act(() => view.unmount());
  });

  it('reveals live Home while the funded balance total is still pending', () => {
    mockTestGlobal.__homePageContainerIsNative = false;
    const backedUp = hdWallet(true);
    setWalletState({ activeWallet: backedUp, walletListWallet: backedUp });
    mockHomePresentationKind = 'fundedPendingTotal';
    mockDisplaySnapshotLoadState = {
      ownerScopeKey: 'scope-hd-1',
      sessionId: 'session-hd-1',
      status: 'miss',
    };

    let view!: ReactTestRenderer;
    act(() => {
      view = create(renderOwner(false));
    });

    expect(view.root.findAllByProps({ testID: 'surface-react' })).toHaveLength(
      1,
    );
    expect(
      view.root.findAllByProps({ testID: 'home-launch-skeleton' }),
    ).toHaveLength(0);
    act(() => view.unmount());
  });

  it('reveals React Home while Store display data and the wallet list are pending', () => {
    mockTestGlobal.__homePageContainerIsNative = false;
    const backedUp = hdWallet(true);
    setWalletState({ activeWallet: backedUp, pending: true });
    mockHomeShellKind = 'loading';
    mockDisplaySnapshotLoadState = {
      ownerScopeKey: 'scope-hd-1',
      sessionId: 'session-hd-1',
      status: 'miss',
    };

    let view!: ReactTestRenderer;
    act(() => {
      view = create(renderOwner(false));
    });

    expect(view.root.findAllByProps({ testID: 'surface-react' })).toHaveLength(
      1,
    );
    expect(
      view.root.findAllByProps({ testID: 'home-launch-skeleton' }),
    ).toHaveLength(0);
    act(() => view.unmount());
  });

  it('uses the same React Home readiness contract on native fallback', () => {
    const backedUp = hdWallet(true);
    setWalletState({ activeWallet: backedUp, pending: true });
    mockHomeShellKind = 'loading';
    mockDisplaySnapshotLoadState = {
      ownerScopeKey: 'scope-hd-1',
      sessionId: 'session-hd-1',
      status: 'loading',
    };

    let view!: ReactTestRenderer;
    act(() => {
      view = create(renderOwner(false));
    });

    expect(view.root.findAllByProps({ testID: 'surface-react' })).toHaveLength(
      1,
    );
    expect(view.root.findAllByProps({ testID: 'surface-native' })).toHaveLength(
      0,
    );
    act(() => view.unmount());
  });

  it('reveals an interactive cached cold-start surface before BG validation', () => {
    const backedUp = hdWallet(true);
    setWalletState({ activeWallet: backedUp, pending: true });
    mockAccountSelectorStorageInitDone = false;
    mockActiveAccountInitDone = false;

    let view!: ReactTestRenderer;
    act(() => {
      view = create(renderOwner());
    });

    expect(view.root.findAllByProps({ testID: 'surface-native' })).toHaveLength(
      1,
    );
    expect(
      view.root.findAllByProps({ opacity: 1, pointerEvents: 'auto' }).length,
    ).toBeGreaterThan(0);

    mockAccountSelectorStorageInitDone = true;
    mockActiveAccountInitDone = true;
    setWalletState({ activeWallet: backedUp, walletListWallet: backedUp });
    act(() => view.update(renderOwner()));

    expect(mockSurfaceLifecycle.native).toEqual({ mounts: 1, unmounts: 0 });
    expect(
      view.root.findAllByProps({ opacity: 1, pointerEvents: 'auto' }).length,
    ).toBeGreaterThan(0);
    act(() => view.unmount());
  });

  it('mounts no native fallback while the synchronous display cache loads', () => {
    const backedUp = hdWallet(true);
    setWalletState({ activeWallet: backedUp, pending: true });
    mockDisplaySnapshotLoadState = {
      ownerScopeKey: 'scope-hd-1',
      sessionId: 'stale-session',
      status: 'hit',
    };

    let view!: ReactTestRenderer;
    act(() => {
      view = create(renderOwner());
    });

    expect(
      view.root.findAllByProps({ testID: 'home-launch-skeleton' }),
    ).toHaveLength(0);
    expect(view.root.findAllByProps({ testID: 'surface-native' })).toHaveLength(
      0,
    );

    mockDisplaySnapshotLoadState = {
      ownerScopeKey: 'scope-hd-1',
      sessionId: 'session-hd-1',
      status: 'loading',
    };
    act(() => view.update(renderOwner()));
    expect(
      view.root.findAllByProps({ testID: 'home-launch-skeleton' }),
    ).toHaveLength(0);
    expect(view.root.findAllByProps({ testID: 'surface-native' })).toHaveLength(
      0,
    );

    mockDisplaySnapshotLoadState = {
      ownerScopeKey: 'scope-hd-1',
      sessionId: 'session-hd-1',
      status: 'hit',
    };
    act(() => view.update(renderOwner()));

    expect(view.root.findAllByProps({ testID: 'surface-native' })).toHaveLength(
      1,
    );
    expect(mockSurfaceLifecycle.native).toEqual({ mounts: 1, unmounts: 0 });
    act(() => view.unmount());
  });

  it('keeps one Native page through same-wallet backup state changes', () => {
    let view!: ReactTestRenderer;
    act(() => {
      view = create(renderOwner());
    });
    expect(view.root.findAllByProps({ testID: 'surface-empty' })).toHaveLength(
      0,
    );
    expect(view.root.findAllByProps({ testID: 'surface-native' })).toHaveLength(
      0,
    );
    expect(view.root.findAllByProps({ testID: 'surface-react' })).toHaveLength(
      0,
    );

    const unbacked = hdWallet(false);
    setWalletState({ activeWallet: unbacked, walletListWallet: unbacked });
    act(() => view.update(renderOwner()));
    expect(mockSurfaceLifecycle.native).toEqual({ mounts: 1, unmounts: 0 });
    expect(view.root.findAllByProps({ testID: 'surface-native' })).toHaveLength(
      1,
    );
    expect(mockSurfaceLifecycle.empty.mounts).toBe(0);
    expect(mockSurfaceLifecycle.react.mounts).toBe(0);

    mockActiveAccount = {
      ready: true,
      wallet: unbacked,
      account: { id: 'account-hd-1' },
      network: { id: 'evm--1' },
    };
    mockWalletList = {
      pending: true,
      result: { wallets: [unbacked] },
    };
    act(() => view.update(renderOwner()));
    expect(mockSurfaceLifecycle.native).toEqual({ mounts: 1, unmounts: 0 });

    const backedUp = hdWallet(true);
    setWalletState({ activeWallet: backedUp, walletListWallet: unbacked });
    act(() => view.update(renderOwner()));
    expect(mockSurfaceLifecycle.native).toEqual({ mounts: 1, unmounts: 0 });

    setWalletState({ activeWallet: backedUp, walletListWallet: backedUp });
    act(() => view.update(renderOwner()));
    act(() => view.update(renderOwner()));
    expect(mockSurfaceLifecycle.empty).toEqual({ mounts: 0, unmounts: 0 });
    expect(mockSurfaceLifecycle.native).toEqual({ mounts: 1, unmounts: 0 });
    expect(mockSurfaceLifecycle.react.mounts).toBe(0);
    expect(view.root.findAllByProps({ testID: 'surface-native' })).toHaveLength(
      1,
    );
  });

  it('keeps the old Native page until a replacement wallet surface is ready', () => {
    const unbacked = hdWallet(false);
    setWalletState({ activeWallet: unbacked, walletListWallet: unbacked });
    let view!: ReactTestRenderer;
    act(() => {
      view = create(renderOwner());
    });
    expect(view.root.findAllByProps({ testID: 'surface-native' })).toHaveLength(
      1,
    );

    const previousHomeSession = mockHomeSession;
    setWalletState({ activeWallet: hdWallet(false, 'hd-2'), pending: true });
    mockHomeSession = previousHomeSession;
    mockDisplaySnapshotLoadState = {
      ownerScopeKey: 'scope-hd-2',
      sessionId: 'session-hd-2',
      status: 'loading',
    };
    act(() => view.update(renderOwner()));
    expect(mockSurfaceLifecycle.native).toEqual({ mounts: 1, unmounts: 0 });
    expect(view.root.findAllByProps({ testID: 'surface-native' })).toHaveLength(
      1,
    );
    expect(view.root.findAllByProps({ testID: 'surface-react' })).toHaveLength(
      0,
    );
    expect(
      view.root.findAllByProps({ opacity: 1, pointerEvents: 'auto' }).length,
    ).toBeGreaterThan(0);

    const replacement = hdWallet(false, 'hd-2');
    setWalletState({
      activeWallet: replacement,
      walletListWallet: replacement,
    });
    act(() => view.update(renderOwner()));
    expect(mockSurfaceLifecycle.native).toEqual({ mounts: 2, unmounts: 1 });
    expect(view.root.findAllByProps({ testID: 'surface-native' })).toHaveLength(
      1,
    );
  });

  it('keeps a same-owner renderer interactive during session replacement', () => {
    const backedUp = hdWallet(true);
    setWalletState({ activeWallet: backedUp, walletListWallet: backedUp });
    let view!: ReactTestRenderer;
    act(() => {
      view = create(renderOwner());
    });

    mockDisplaySnapshotLoadState = {
      ownerScopeKey: 'scope-hd-1',
      sessionId: 'replacement-session',
      status: 'loading',
    };
    act(() => view.update(renderOwner()));

    expect(view.root.findAllByProps({ testID: 'surface-native' })).toHaveLength(
      1,
    );
    expect(
      view.root.findAllByProps({ opacity: 1, pointerEvents: 'auto' }).length,
    ).toBeGreaterThan(0);
    act(() => view.unmount());
  });

  it.each([
    [true, 'native'],
    [false, 'react'],
  ] as const)(
    'keeps the %s surface mounted while same-owner recovery flags are pending',
    (nativeHomeEnabled, surface) => {
      const backedUp = hdWallet(true);
      setWalletState({ activeWallet: backedUp, walletListWallet: backedUp });
      let view!: ReactTestRenderer;
      act(() => {
        view = create(renderOwner(nativeHomeEnabled));
      });
      expect(mockSurfaceLifecycle[surface]).toEqual({ mounts: 1, unmounts: 0 });

      mockLaunchSnapshot.readyHomeGeneration = 1;
      mockAccountSelectorStorageInitDone = false;
      mockActiveAccountInitDone = false;
      act(() => view.update(renderOwner(nativeHomeEnabled)));

      expect(mockSurfaceLifecycle[surface]).toEqual({ mounts: 1, unmounts: 0 });
      expect(
        view.root.findAllByProps({ testID: `surface-${surface}` }),
      ).toHaveLength(1);

      mockActiveAccount.ready = false;
      act(() => view.update(renderOwner(nativeHomeEnabled)));

      expect(mockSurfaceLifecycle[surface]).toEqual({ mounts: 1, unmounts: 0 });
      expect(
        view.root.findAllByProps({ testID: `surface-${surface}` }),
      ).toHaveLength(1);
      act(() => view.unmount());
    },
  );

  it.each([
    ['no-wallet', undefined, undefined, true, 'react'],
    ['normal React', hdWallet(true), hdWallet(true), false, 'react'],
    ['normal native', hdWallet(true), hdWallet(true), true, 'native'],
  ] as const)(
    'renders only the %s owner',
    (_label, activeWallet, walletListWallet, nativeHomeEnabled, expected) => {
      setWalletState({ activeWallet, walletListWallet });
      let view!: ReactTestRenderer;
      act(() => {
        view = create(renderOwner(nativeHomeEnabled));
      });
      expect(
        view.root.findAllByProps({ testID: `surface-${expected}` }),
      ).toHaveLength(1);
      expect(mockSurfaceLifecycle[expected].mounts).toBe(1);
      expect(
        view.root.findAllByProps({ testID: 'surface-empty' }),
      ).toHaveLength(0);
      expect(
        view.root.findAllByProps({
          testID: expected === 'native' ? 'surface-react' : 'surface-native',
        }),
      ).toHaveLength(0);
    },
  );
});
