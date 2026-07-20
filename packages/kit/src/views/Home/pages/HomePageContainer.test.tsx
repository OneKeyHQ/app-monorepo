import type { ReactNode } from 'react';

import { type ReactTestRenderer, act, create } from 'react-test-renderer';

import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { HomeLaunchGatedContent, HomePageContainer } from './HomePageContainer';

type IMockWallet = {
  id: string;
  type: string;
  backuped?: boolean;
};

type IMockSurfaceName = 'empty' | 'native' | 'legacy';

const mockSurfaceLifecycle: Record<
  IMockSurfaceName,
  { mounts: number; unmounts: number }
> = {
  empty: { mounts: 0, unmounts: 0 },
  native: { mounts: 0, unmounts: 0 },
  legacy: { mounts: 0, unmounts: 0 },
};

let mockActiveAccount: {
  ready: boolean;
  wallet?: IMockWallet;
  account?: { id: string };
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
let mockShadowBridgeMounts = 0;
let mockIsNative = true;
const mockTestGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
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
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isNative() {
      return mockIsNative;
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
  ProviderJotaiContextHome: ({ children }: { children?: ReactNode }) =>
    children,
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
  useJotaiContextRootStore: () => ({}),
}));

jest.mock('../../Notifications/components/NotificationRegisterDaily', () => ({
  NotificationRegisterDaily: () => null,
}));

jest.mock('../../Onboarding/components/onboardingLaunchGate', () => ({
  isMainHomeReadyToReveal: ({
    launchDecision,
    accountSelectorStorageInitDone,
    accountSelectorActiveAccountInitDone,
    activeAccountReady,
    walletListReady,
    activeWalletReady,
  }: {
    launchDecision: string;
    accountSelectorStorageInitDone: boolean;
    accountSelectorActiveAccountInitDone: boolean;
    activeAccountReady: boolean;
    walletListReady: boolean;
    activeWalletReady: boolean;
  }) =>
    launchDecision === 'main' &&
    accountSelectorStorageInitDone &&
    accountSelectorActiveAccountInitDone &&
    activeAccountReady &&
    walletListReady &&
    activeWalletReady,
  markCurrentHomeGenerationReady: jest.fn(),
  useOnboardingLaunchSnapshot: () => mockLaunchSnapshot,
}));

jest.mock('../../Setting/pages/Protection/KYTIntroDialog', () => ({
  KYTIntroOnMount: () => null,
}));

jest.mock('../components/BTCFreshAddressProvider', () => ({
  BTCFreshAddressProvider: () => null,
}));

jest.mock('../nativeHomeFeatureFlag', () => ({
  isNativeHomeEnabled: () => true,
}));

jest.mock('../model/react/HomeAuthorityShadowBridge', () => ({
  HomeAuthorityShadowBridge: () => {
    mockShadowBridgeMounts += 1;
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

jest.mock('./HomePageView', () => ({
  HomePageView: mockCreateSurface('legacy'),
}));

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
  };
  mockWalletList = {
    pending,
    result: pending
      ? undefined
      : { wallets: walletListWallet ? [walletListWallet] : [] },
  };
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
  mockShadowBridgeMounts = 0;
  mockIsNative = true;
});

describe('HomePageContainer shadow authority integration', () => {
  it('mounts the inert shadow bridge without selecting a visible surface', () => {
    let view!: ReactTestRenderer;
    act(() => {
      view = create(<HomePageContainer />);
    });
    expect(mockShadowBridgeMounts).toBe(1);
    expect(view.root.findAllByProps({ testID: 'surface-empty' })).toHaveLength(
      0,
    );
    expect(view.root.findAllByProps({ testID: 'surface-native' })).toHaveLength(
      0,
    );
    expect(view.root.findAllByProps({ testID: 'surface-legacy' })).toHaveLength(
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
});

describe('HomeLaunchGatedContent surface ownership', () => {
  it('does not gate non-native legacy Home on the native launch decision', () => {
    mockIsNative = false;
    mockLaunchSnapshot.decision = 'unknown';
    const backedUp = hdWallet(true);
    setWalletState({ activeWallet: backedUp, walletListWallet: backedUp });

    let view!: ReactTestRenderer;
    act(() => {
      view = create(renderOwner(false));
    });

    expect(view.root.findAllByProps({ testID: 'surface-legacy' })).toHaveLength(
      1,
    );
    expect(mockSurfaceLifecycle.native.mounts).toBe(0);
    act(() => view.unmount());
  });

  it('keeps one Empty page through same-wallet refetch and switches once after backup', () => {
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
    expect(view.root.findAllByProps({ testID: 'surface-legacy' })).toHaveLength(
      0,
    );

    const unbacked = hdWallet(false);
    setWalletState({ activeWallet: unbacked, walletListWallet: unbacked });
    act(() => view.update(renderOwner()));
    expect(mockSurfaceLifecycle.empty).toEqual({ mounts: 1, unmounts: 0 });
    expect(view.root.findAllByProps({ testID: 'surface-empty' })).toHaveLength(
      1,
    );
    expect(mockSurfaceLifecycle.native.mounts).toBe(0);
    expect(mockSurfaceLifecycle.legacy.mounts).toBe(0);

    setWalletState({ activeWallet: unbacked, pending: true });
    act(() => view.update(renderOwner()));
    expect(mockSurfaceLifecycle.empty).toEqual({ mounts: 1, unmounts: 0 });
    expect(mockSurfaceLifecycle.native.mounts).toBe(0);

    const backedUp = hdWallet(true);
    setWalletState({ activeWallet: backedUp, walletListWallet: unbacked });
    act(() => view.update(renderOwner()));
    expect(mockSurfaceLifecycle.empty).toEqual({ mounts: 1, unmounts: 0 });
    expect(mockSurfaceLifecycle.native.mounts).toBe(0);

    setWalletState({ activeWallet: backedUp, walletListWallet: backedUp });
    act(() => view.update(renderOwner()));
    act(() => view.update(renderOwner()));
    expect(mockSurfaceLifecycle.empty).toEqual({ mounts: 1, unmounts: 1 });
    expect(mockSurfaceLifecycle.native).toEqual({ mounts: 1, unmounts: 0 });
    expect(mockSurfaceLifecycle.legacy.mounts).toBe(0);
    expect(view.root.findAllByProps({ testID: 'surface-native' })).toHaveLength(
      1,
    );
  });

  it('unmounts the old Empty page immediately when a new wallet scope is pending', () => {
    const unbacked = hdWallet(false);
    setWalletState({ activeWallet: unbacked, walletListWallet: unbacked });
    let view!: ReactTestRenderer;
    act(() => {
      view = create(renderOwner());
    });
    expect(
      view.root.findAllByProps({ testID: 'empty-wallet-cta' }),
    ).toHaveLength(1);

    setWalletState({ activeWallet: hdWallet(false, 'hd-2'), pending: true });
    act(() => view.update(renderOwner()));
    expect(mockSurfaceLifecycle.empty).toEqual({ mounts: 1, unmounts: 1 });
    expect(
      view.root.findAllByProps({ testID: 'empty-wallet-cta' }),
    ).toHaveLength(0);
    expect(view.root.findAllByProps({ testID: 'surface-native' })).toHaveLength(
      0,
    );
    expect(view.root.findAllByProps({ testID: 'surface-legacy' })).toHaveLength(
      0,
    );
  });

  it.each([
    ['no-wallet', undefined, undefined, true, 'legacy'],
    ['normal legacy', hdWallet(true), hdWallet(true), false, 'legacy'],
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
          testID: expected === 'native' ? 'surface-legacy' : 'surface-native',
        }),
      ).toHaveLength(0);
    },
  );
});
