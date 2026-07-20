import type { ReactNode } from 'react';

import { type ReactTestRenderer, act, create } from 'react-test-renderer';

import {
  ProviderJotaiContextHome,
  useHomeAuthorityShadowAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/home';
import { HOME_RUNTIME_PROTOCOL_VERSION } from '@onekeyhq/shared/src/types/homeRuntime';

import { HomeAuthorityShadowBridge } from '../react/HomeAuthorityShadowBridge';

import type { IHomeAuthorityShadowSnapshot } from '../lifecycle/homeSessionCoordinator';

const mockGetHandshake = jest.fn();
let mockActiveAccount: {
  ready: boolean;
  wallet?: { id: string };
  account?: { id: string };
  network?: { id: string; isAllNetworks?: boolean };
};
const mockTestGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isExtension: false,
    isNative: true,
  },
}));

jest.mock('../../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceBootstrap: {
      getHomeRuntimeHandshake: () => mockGetHandshake() as Promise<unknown>,
    },
  },
}));

jest.mock('../../../../states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({ activeAccount: mockActiveAccount }),
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/jotaiStorage', () => {
  const { atom } = jest.requireActual<typeof import('jotai')>('jotai');
  return {
    MMKV_MIGRATION_COMPLETE_KEY: '__test__',
    atomWithStorage: (_name: string, initialValue: unknown) =>
      atom(initialValue),
    buildJotaiStorageKey: (name: string) => name,
    globalJotaiStorageReadyHandler: { ready: Promise.resolve() },
  };
});

function getMockPlatformEnv() {
  return (
    jest.requireMock('@onekeyhq/shared/src/platformEnv') as {
      default: { isExtension: boolean; isNative: boolean };
    }
  ).default;
}

function SnapshotObserver({
  onSnapshot,
}: {
  onSnapshot: (snapshot: IHomeAuthorityShadowSnapshot) => void;
}) {
  const [snapshot] = useHomeAuthorityShadowAtom();
  onSnapshot(snapshot);
  return null;
}

function TestOwner({
  children,
  onSnapshot,
}: {
  children?: ReactNode;
  onSnapshot: (snapshot: IHomeAuthorityShadowSnapshot) => void;
}) {
  return (
    <ProviderJotaiContextHome>
      {children}
      <HomeAuthorityShadowBridge />
      <SnapshotObserver onSnapshot={onSnapshot} />
    </ProviderJotaiContextHome>
  );
}

function setActiveOwner(walletId: string) {
  mockActiveAccount = {
    ready: true,
    wallet: { id: walletId },
    account: { id: `account-${walletId}` },
    network: { id: 'evm-1' },
  };
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('Home authority shadow context', () => {
  beforeAll(() => {
    mockTestGlobal.IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterAll(() => {
    delete mockTestGlobal.IS_REACT_ACT_ENVIRONMENT;
  });

  beforeEach(() => {
    const mockPlatformEnv = getMockPlatformEnv();
    mockGetHandshake.mockReset();
    mockGetHandshake.mockResolvedValue({
      protocolVersion: HOME_RUNTIME_PROTOCOL_VERSION,
      producerInstanceId: 'producer-1',
    });
    mockPlatformEnv.isNative = true;
    mockPlatformEnv.isExtension = false;
    mockActiveAccount = { ready: false };
  });

  it('tracks split-runtime A -> B -> A ownership without rendering content', async () => {
    const snapshots: IHomeAuthorityShadowSnapshot[] = [];
    const onSnapshot = (snapshot: IHomeAuthorityShadowSnapshot) =>
      snapshots.push(snapshot);
    setActiveOwner('wallet-a');
    let view!: ReactTestRenderer;
    act(() => {
      view = create(<TestOwner onSnapshot={onSnapshot} />);
    });
    await flushEffects();
    const firstASession = snapshots.at(-1)?.ownerToken?.sessionId;
    expect(snapshots.at(-1)).toMatchObject({
      topology: 'split',
      status: 'active',
      producerInstanceId: 'producer-1',
    });

    setActiveOwner('wallet-b');
    act(() => view.update(<TestOwner onSnapshot={onSnapshot} />));
    await flushEffects();
    setActiveOwner('wallet-a');
    act(() => view.update(<TestOwner onSnapshot={onSnapshot} />));
    await flushEffects();

    expect(snapshots.at(-1)?.ownerToken?.sessionId).not.toBe(firstASession);
    expect(mockGetHandshake).toHaveBeenCalledTimes(3);
    expect(view.toJSON()).toBeNull();
    act(() => view.unmount());
  });

  it('uses a direct single-runtime handshake on desktop/web', async () => {
    getMockPlatformEnv().isNative = false;
    setActiveOwner('wallet-a');
    const snapshots: IHomeAuthorityShadowSnapshot[] = [];
    let view!: ReactTestRenderer;
    act(() => {
      view = create(
        <TestOwner onSnapshot={(snapshot) => snapshots.push(snapshot)} />,
      );
    });
    await flushEffects();
    expect(snapshots.at(-1)).toMatchObject({
      topology: 'single',
      status: 'active',
    });
    expect(mockGetHandshake).not.toHaveBeenCalled();
    act(() => view.unmount());
  });
});
